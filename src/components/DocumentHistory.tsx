import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  title: string;
  input_text: string;
  output_text: string | null;
  word_count: number;
  ai_score: number | null;
  human_score: number | null;
  created_at: string;
}

interface DocumentHistoryProps {
  documents: Document[];
  loading: boolean;
  onSelect: (doc: Document) => void;
  onDelete: (docId: string) => void;
  selectedId?: string;
}

const DocumentHistory = ({
  documents,
  loading,
  onSelect,
  onDelete,
  selectedId,
}: DocumentHistoryProps) => {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Recent Documents</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <h3 className="mb-4 px-2 text-sm font-semibold text-foreground">Recent Documents</h3>

      {documents.length === 0 ? (
        <div className="py-8 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No documents yet</p>
          <p className="text-xs text-muted-foreground">Your humanized texts will appear here</p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-1">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "group flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted",
                  selectedId === doc.id && "bg-primary/10"
                )}
                onClick={() => onSelect(doc)}
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {doc.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{doc.word_count} words</span>
                    <span>•</span>
                    <span>{format(new Date(doc.created_at), "MMM d, h:mm a")}</span>
                  </div>
                  {doc.human_score && (
                    <div className="mt-1">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          doc.human_score >= 70
                            ? "bg-success/10 text-success"
                            : doc.human_score >= 40
                            ? "bg-warning/10 text-warning"
                            : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {doc.human_score}% Human
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(doc.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default DocumentHistory;
