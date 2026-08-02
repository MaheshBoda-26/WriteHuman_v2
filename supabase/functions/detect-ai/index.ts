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

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
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

The aiScore and humanScore should sum to 100.

Return ONLY a JSON object with this exact format:
{
  "aiScore": number,
  "humanScore": number,
  "confidence": "low" | "medium" | "high",
  "signals": string[]
}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://writehuman.app",
        "X-Title": "WriteHuman",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this text for AI detection:\n\n${text}` },
        ],
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
      console.error("OpenRouter error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response from AI");
    }

    // Parse JSON from response
    let result: { aiScore: number; humanScore: number; confidence: string; signals: string[] };
    try {
      // Extract JSON from markdown code blocks or raw text
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      result = JSON.parse(jsonStr);
    } catch {
      throw new Error("Could not parse AI response as detection result");
    }

    // Ensure scores are valid
    const aiScore = Math.max(0, Math.min(100, Math.round(result.aiScore ?? 50)));
    const humanScore = Math.max(0, Math.min(100, Math.round(result.humanScore ?? 50)));

    return new Response(
      JSON.stringify({
        aiScore,
        humanScore,
        confidence: result.confidence ?? "medium",
        signals: result.signals ?? [],
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
