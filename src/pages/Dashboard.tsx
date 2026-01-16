import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import TextEditor from "@/components/TextEditor";
import DocumentHistory from "@/components/DocumentHistory";
import { Loader2 } from "lucide-react";

interface Document {
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
  created_at: string;
}

const Dashboard = () => {
  const { user, profile, loading, updateWordUsage, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  const fetchDocuments = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setDocuments(data as Document[]);
    }
    setLoadingDocs(false);
  };

  const handleSaveDocument = async (doc: {
    title: string;
    inputText: string;
    outputText: string;
    wordCount: number;
    aiScore?: number;
    humanScore?: number;
    readability: string;
    purpose: string;
    bypassLevel: string;
  }) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { data, error } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        title: doc.title,
        input_text: doc.inputText,
        output_text: doc.outputText,
        word_count: doc.wordCount,
        ai_score: doc.aiScore,
        human_score: doc.humanScore,
        readability: doc.readability,
        purpose: doc.purpose,
        bypass_level: doc.bypassLevel,
      })
      .select()
      .single();

    if (!error && data) {
      setDocuments([data as Document, ...documents]);
      await updateWordUsage(doc.wordCount);
      await refreshProfile();
    }

    return { error };
  };

  const handleSelectDocument = (doc: Document) => {
    setSelectedDocument(doc);
  };

  const handleDeleteDocument = async (docId: string) => {
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", docId);

    if (!error) {
      setDocuments(documents.filter((d) => d.id !== docId));
      if (selectedDocument?.id === docId) {
        setSelectedDocument(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-6">
        <div className="container">
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            {/* Main Editor */}
            <div>
              <TextEditor
                onSave={handleSaveDocument}
                selectedDocument={selectedDocument}
              />
            </div>

            {/* Document History Sidebar */}
            <div className="hidden lg:block">
              <DocumentHistory
                documents={documents}
                loading={loadingDocs}
                onSelect={handleSelectDocument}
                onDelete={handleDeleteDocument}
                selectedId={selectedDocument?.id}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
