
'use client';

import { useState, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getDocuments, saveDocument, Document, getFolders, Folder, createFolder, deleteFolder, moveDocumentToFolder } from '@/lib/db';

export function useDocumentLibrary() {
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [userDocuments, setUserDocuments] = useState<Document[]>([]);
  const [userFolders, setUserFolders] = useState<Folder[]>([]);
  const { toast } = useToast();

  const fetchUserDocumentsAndFolders = useCallback(async () => {
    try {
      const [docs, folders] = await Promise.all([getDocuments(), getFolders()]);
      setUserDocuments(docs);
      setUserFolders(folders);

      // If there's an active document, find its updated version in the new list
      if (activeDoc) {
        const updatedActiveDoc = docs.find(d => d.id === activeDoc.id);
        if (updatedActiveDoc) {
          setActiveDoc(updatedActiveDoc);
        } else {
          // The active doc was deleted, clear it
          setActiveDoc(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
      toast({ variant: "destructive", title: "Error", description: "Could not load your library." });
    }
  }, [toast, activeDoc]);

  const clearActiveDocState = () => {
      setActiveDoc(null);
  }

  const handleSelectDocument = useCallback(async (doc: Document) => {
    setActiveDoc(doc);
  }, []);
  
  const handleDeleteDocument = async (docId: string | null) => {
    if (!docId) return;
    try {
        const result = await deleteDocument(docId);
        if (result.success) {
            toast({ title: "Success", description: "Document deleted successfully." });
            if (activeDoc?.id === docId) setActiveDoc(null);
            fetchUserDocumentsAndFolders();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        toast({ variant: "destructive", title: "Deletion Error", description: `Could not delete document: ${errorMessage}` });
    }
  };
  
  // Folder actions
  const handleCreateFolder = async (name: string) => {
      await createFolder(name);
      await fetchUserDocumentsAndFolders();
  };

  const handleDeleteFolder = async (folderId: string) => {
      await deleteFolder(folderId);
      await fetchUserDocumentsAndFolders();
  };
  
  const handleMoveDocument = async (docId: string, folderId: string | null) => {
      await moveDocumentToFolder(docId, folderId);
      await fetchUserDocumentsAndFolders();
  };

  return {
    activeDoc,
    setActiveDoc,
    userDocuments,
    userFolders,
    fetchUserDocumentsAndFolders,
    handleSelectDocument,
    handleDeleteDocument,
    handleCreateFolder,
    handleDeleteFolder,
    handleMoveDocument,
    clearActiveDocState,
  };
}
