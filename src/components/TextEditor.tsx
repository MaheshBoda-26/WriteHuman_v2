import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Copy, Sparkles, ScanSearch, Check, Loader2, Save, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const HUMANIZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/humanize`;
const DETECT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-ai`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function streamHumanize({
  text,
  readability,
  purpose,
  bypassLevel,
  onDelta,
  onDone,
  onError,
}: {
  text: string;
  readability: string;
  purpose: string;
  bypassLevel: string;
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  const resp = await fetch(HUMANIZE_URL, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ text, readability, purpose, bypassLevel }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ error: "Request failed" }));
    onError(errorData.error || "Failed to humanize text");
    return;
  }

  if (!resp.body) {
    onError("No response body");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

interface SelectedDocument {
  id: string;
  title: string;
  input_text: string;
  output_text: string | null;
  word_count: number;
  ai_score: number | null;
  human_score: number | null;
  readability: string;
  purpose: string;
  bypass_level: string;
}

interface TextEditorProps {
  onSave?: (doc: {
    title: string;
    inputText: string;
    outputText: string;
    wordCount: number;
    aiScore?: number;
    humanScore?: number;
    readability: string;
    purpose: string;
    bypassLevel: string;
  }) => Promise<{ error: unknown } | undefined>;
  selectedDocument?: SelectedDocument | null;
}

const TextEditor = ({ onSave, selectedDocument }: TextEditorProps) => {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [readability, setReadability] = useState("general");
  const [purpose, setPurpose] = useState("academic");
  const [bypassLevel, setBypassLevel] = useState("standard");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detectionResult, setDetectionResult] = useState<{
    aiScore: number;
    humanScore: number;
    confidence?: string;
    signals?: string[];
  } | null>(null);
  const [passCount, setPassCount] = useState(0);
  const [passHistory, setPassHistory] = useState<Array<{ pass: number; humanScore: number }>>([]);
  const [isRehumanizing, setIsRehumanizing] = useState(false);
  const { toast } = useToast();

  // Load selected document
  useEffect(() => {
    if (selectedDocument) {
      setInputText(selectedDocument.input_text);
      setOutputText(selectedDocument.output_text || "");
      setReadability(selectedDocument.readability || "general");
      setPurpose(selectedDocument.purpose || "academic");
      setBypassLevel(selectedDocument.bypass_level || "standard");
      setPassCount(0);
      setPassHistory([]);
      if (selectedDocument.human_score && selectedDocument.ai_score) {
        setDetectionResult({
          humanScore: selectedDocument.human_score,
          aiScore: selectedDocument.ai_score,
        });
      }
    }
  }, [selectedDocument]);

  const wordCount = (text: string) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  };

  const generateTitle = (text: string) => {
    const words = text.trim().split(/\s+/).slice(0, 6);
    return words.join(" ") + (text.trim().split(/\s+/).length > 6 ? "..." : "");
  };

  const handleScan = useCallback(async (textToScan?: string) => {
    const text = textToScan || outputText;
    if (!text.trim()) return;
    
    setIsScanning(true);
    setDetectionResult(null);
    
    try {
      const resp = await fetch(DETECT_URL, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ text }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: "Detection failed" }));
        throw new Error(errorData.error || "Failed to analyze text");
      }

      const result = await resp.json();
      
      setDetectionResult({
        aiScore: result.aiScore,
        humanScore: result.humanScore,
        confidence: result.confidence,
        signals: result.signals,
      });
    } catch (error) {
      toast({
        title: "Detection failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  }, [outputText, toast]);

  const handleHumanize = useCallback(async () => {
    if (!inputText.trim()) return;
    
    setIsProcessing(true);
    setDetectionResult(null);
    setOutputText("");
    setPassCount(1);
    setPassHistory([]);
    
    let humanizedText = "";
    
    try {
      await streamHumanize({
        text: inputText,
        readability,
        purpose,
        bypassLevel,
        onDelta: (chunk) => {
          humanizedText += chunk;
          setOutputText(humanizedText);
        },
        onDone: () => {
          setIsProcessing(false);
          // Auto-scan after humanizing
          handleScan(humanizedText);
        },
        onError: (error) => {
          setIsProcessing(false);
          toast({
            title: "Humanization failed",
            description: error,
            variant: "destructive",
          });
        },
      });
    } catch (error) {
      setIsProcessing(false);
      toast({
        title: "Humanization failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  }, [inputText, readability, purpose, bypassLevel, toast, handleScan]);

  const handleRehumanize = useCallback(async () => {
    if (!outputText.trim()) return;

    // Save current score to history before re-humanizing
    if (detectionResult) {
      setPassHistory(prev => [...prev, { pass: passCount, humanScore: detectionResult.humanScore }]);
    }
    
    setIsRehumanizing(true);
    setDetectionResult(null);
    
    const currentOutput = outputText;
    setOutputText("");
    
    let humanizedText = "";
    
    try {
      await streamHumanize({
        text: currentOutput,
        readability,
        purpose,
        bypassLevel: "enhanced", // Use enhanced bypass for re-humanization
        onDelta: (chunk) => {
          humanizedText += chunk;
          setOutputText(humanizedText);
        },
        onDone: () => {
          setIsRehumanizing(false);
          setPassCount(prev => prev + 1);
          // Auto-scan after re-humanizing
          handleScan(humanizedText);
        },
        onError: (error) => {
          setIsRehumanizing(false);
          setOutputText(currentOutput); // Restore previous output on error
          toast({
            title: "Re-humanization failed",
            description: error,
            variant: "destructive",
          });
        },
      });
    } catch (error) {
      setIsRehumanizing(false);
      setOutputText(currentOutput);
      toast({
        title: "Re-humanization failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  }, [outputText, readability, purpose, detectionResult, passCount, toast, handleScan]);

  const handleCopy = useCallback(() => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [outputText]);

  const handleSave = useCallback(async () => {
    if (!onSave || !outputText.trim()) return;
    
    setIsSaving(true);
    
    const result = await onSave({
      title: generateTitle(inputText),
      inputText,
      outputText,
      wordCount: wordCount(outputText),
      aiScore: detectionResult?.aiScore,
      humanScore: detectionResult?.humanScore,
      readability,
      purpose,
      bypassLevel,
    });
    
    setIsSaving(false);
    
    if (!result?.error) {
      toast({
        title: "Document saved",
        description: "Your humanized text has been saved to history.",
      });
    }
  }, [onSave, inputText, outputText, detectionResult, readability, purpose, bypassLevel, toast]);

  const getDetectionBadgeClass = (humanScore: number) => {
    if (humanScore >= 70) return "detection-badge detection-badge-human";
    if (humanScore >= 40) return "detection-badge detection-badge-mixed";
    return "detection-badge detection-badge-ai";
  };

  return (
    <div className="w-full">
      {/* Controls Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-card">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Readability:</span>
            <Select value={readability} onValueChange={setReadability}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="university">University</SelectItem>
                <SelectItem value="doctorate">Doctorate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Purpose:</span>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="journalism">Journalism</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="essay">Essay</SelectItem>
                <SelectItem value="story">Story</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Bypass:</span>
            <Select value={bypassLevel} onValueChange={setBypassLevel}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="enhanced">Enhanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          variant="hero"
          size="lg"
          onClick={handleHumanize}
          disabled={!inputText.trim() || isProcessing}
          className="gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Humanizing...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Humanize & Scan
            </>
          )}
        </Button>
      </div>

      {/* Editor Panels */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Panel */}
        <div className="editor-panel relative flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">AI-Generated Text</h3>
            <span className="text-sm text-muted-foreground">{wordCount(inputText)} words</span>
          </div>
          <Textarea
            placeholder="Paste your AI-generated text here..."
            className="min-h-[320px] flex-1 resize-none border-0 bg-transparent p-0 text-base leading-relaxed focus-visible:ring-0"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleScan(inputText)}
              disabled={!inputText.trim() || isScanning}
              className="gap-2"
            >
              <ScanSearch className="h-4 w-4" />
              Detect AI
            </Button>
          </div>
        </div>

        {/* Output Panel */}
        <div className="editor-panel relative flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-foreground">Humanized Text</h3>
              {passCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Pass {passCount}
                </span>
              )}
              {detectionResult && (
                <div className={cn(getDetectionBadgeClass(detectionResult.humanScore))}>
                  {isScanning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  <span>{detectionResult.humanScore}% Human</span>
                </div>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{wordCount(outputText)} words</span>
          </div>
          
          <Textarea
            placeholder="Your humanized text will appear here..."
            className="min-h-[320px] flex-1 resize-none border-0 bg-transparent p-0 text-base leading-relaxed focus-visible:ring-0"
            value={outputText}
            onChange={(e) => setOutputText(e.target.value)}
            readOnly={isProcessing || isRehumanizing}
          />
          
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleScan()}
                disabled={!outputText.trim() || isScanning || isRehumanizing}
                className="gap-2"
              >
                {isScanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanSearch className="h-4 w-4" />
                )}
                Re-scan
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={handleRehumanize}
                disabled={!outputText.trim() || isRehumanizing || isProcessing}
                className="gap-2"
              >
                {isRehumanizing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Re-humanizing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Re-humanize
                  </>
                )}
              </Button>
              
              {onSave && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={!outputText.trim() || isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </Button>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!outputText.trim()}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Detection Results Bar */}
      {detectionResult && !isScanning && (
        <div className="mt-6 animate-fade-in rounded-xl border bg-card p-6 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                AI Detection Analysis
                {passCount > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (Pass {passCount})
                  </span>
                )}
              </h4>
              <p className="text-sm text-muted-foreground">
                Powered by advanced AI pattern recognition
                {detectionResult.confidence && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {detectionResult.confidence} confidence
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{detectionResult.humanScore}%</div>
                <div className="text-xs text-muted-foreground">Human-like</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">{detectionResult.aiScore}%</div>
                <div className="text-xs text-muted-foreground">AI-detected</div>
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-success to-success/80 transition-all duration-1000 ease-out"
              style={{ width: `${detectionResult.humanScore}%` }}
            />
          </div>

          {/* Pass History */}
          {passHistory.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h5 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pass History
              </h5>
              <div className="flex items-end gap-2">
                {passHistory.map((entry, index) => (
                  <div key={index} className="flex flex-col items-center gap-1">
                    <div 
                      className="w-10 rounded-t bg-gradient-to-t from-primary/50 to-primary transition-all duration-500"
                      style={{ height: `${entry.humanScore * 0.6}px` }}
                    />
                    <span className="text-xs text-muted-foreground">P{entry.pass}</span>
                    <span className="text-xs font-medium">{entry.humanScore}%</span>
                  </div>
                ))}
                <div className="flex flex-col items-center gap-1">
                  <div 
                    className="w-10 rounded-t bg-gradient-to-t from-success/50 to-success transition-all duration-500"
                    style={{ height: `${detectionResult.humanScore * 0.6}px` }}
                  />
                  <span className="text-xs text-muted-foreground">P{passCount}</span>
                  <span className="text-xs font-medium text-success">{detectionResult.humanScore}%</span>
                </div>
              </div>
              {passHistory.length > 0 && detectionResult.humanScore > passHistory[passHistory.length - 1].humanScore && (
                <p className="mt-2 text-sm text-success">
                  +{detectionResult.humanScore - passHistory[passHistory.length - 1].humanScore}% improvement from last pass
                </p>
              )}
            </div>
          )}

          {/* Detection Signals */}
          {detectionResult.signals && detectionResult.signals.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Detection Signals
              </h5>
              <ul className="space-y-1">
                {detectionResult.signals.map((signal, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Re-humanize suggestion */}
          {detectionResult.humanScore < 80 && passCount > 0 && !isRehumanizing && (
            <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                Score below 80%? Try re-humanizing for better results.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRehumanize}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Re-humanize
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TextEditor;
