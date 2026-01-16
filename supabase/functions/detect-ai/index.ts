import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert AI content detector that analyzes text to determine if it was written by AI or a human. Analyze the provided text using these detection signals:

AI-Generated Indicators:
- Overly consistent sentence structure and length
- Lack of personal voice, emotions, or unique perspective
- Perfect grammar with no natural imperfections
- Generic transitional phrases ("Furthermore," "In conclusion," "It is worth noting")
- Repetitive sentence starters
- Uniform paragraph lengths
- Abstract or vague examples instead of specific anecdotes
- Predictable vocabulary choices
- Lack of colloquialisms, slang, or informal language
- Missing hedging language humans naturally use ("I think," "maybe," "sort of")

Human-Written Indicators:
- Varied sentence structure and rhythm
- Personal anecdotes and specific examples
- Occasional minor grammatical quirks
- Unique voice and perspective
- Emotional undertones
- Natural digressions or parenthetical thoughts
- Colloquial language and idioms
- Inconsistent but natural flow
- Specific cultural or contextual references

Provide your analysis as a JSON object with this exact structure:
{
  "aiScore": <number 0-100 representing likelihood of AI generation>,
  "humanScore": <number 0-100 representing likelihood of human authorship>,
  "confidence": "<low|medium|high>",
  "signals": [<array of 3-5 specific observations about the text>]
}

The aiScore and humanScore should sum to 100.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this text for AI detection:\n\n${text}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_detection_result",
              description: "Report the AI detection analysis results",
              parameters: {
                type: "object",
                properties: {
                  aiScore: {
                    type: "number",
                    description: "Likelihood of AI generation (0-100)",
                  },
                  humanScore: {
                    type: "number",
                    description: "Likelihood of human authorship (0-100)",
                  },
                  confidence: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                    description: "Confidence level of the detection",
                  },
                  signals: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific observations about the text (3-5 items)",
                  },
                },
                required: ["aiScore", "humanScore", "confidence", "signals"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_detection_result" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "report_detection_result") {
      throw new Error("Invalid response from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    // Ensure scores are valid
    const aiScore = Math.max(0, Math.min(100, Math.round(result.aiScore || 50)));
    const humanScore = Math.max(0, Math.min(100, Math.round(result.humanScore || 50)));
    
    return new Response(
      JSON.stringify({
        aiScore,
        humanScore,
        confidence: result.confidence || "medium",
        signals: result.signals || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Detection error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
