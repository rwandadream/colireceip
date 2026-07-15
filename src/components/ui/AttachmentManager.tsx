import { useEffect, useState } from 'react';
import { Download, Eye, FileText, Image, Trash2, UploadCloud } from 'lucide-react';
import type { Attachment, AttachmentEntityType } from '../../lib/types';
import { createAttachment, deleteAttachment, getAttachmentsByEntity } from '../../lib/data';
import { Button } from './Button';
import { Modal } from './Modal';

const ACCEPTED_MIME_TYPES = ['image/', 'application/pdf'];
const DEFAULT_MAX_SIZE_MB = 10;

interface AttachmentManagerProps {
  entityType: AttachmentEntityType;
  entityId?: string;
  initialAttachments?: Attachment[];
  onChange?: (attachments: Attachment[]) => void;
  disabled?: boolean;
  maxSizeMB?: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function isAcceptedFile(file: File) {
  return ACCEPTED_MIME_TYPES.some((type) => file.type.startsWith(type));
}

export function AttachmentManager({
  entityType,
  entityId,
  initialAttachments = [],
  onChange,
  disabled = false,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
}: AttachmentManagerProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<{ url: string; filename: string } | null>(null);

  useEffect(() => {
    let active = true;

    if (entityId) {
      getAttachmentsByEntity(entityType, entityId).then((items) => {
        if (!active) return;
        setAttachments(items);
        onChange?.(items);
      });
    } else {
      setAttachments(initialAttachments);
    }

    return () => {
      active = false;
    };
  }, [entityId, entityType, initialAttachments, onChange]);

  const handleFiles = async (files: FileList | File[]) => {
    if (disabled) return;
    setError('');
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      if (!isAcceptedFile(file)) {
        setError('Seuls les fichiers images et PDF sont acceptés.');
        return false;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`Chaque fichier doit faire moins de ${maxSizeMB} Mo.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const draftAttachments: Attachment[] = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      entity_type: entityType,
      entity_id: entityId ?? '',
      filename: file.name,
      mime_type: file.type,
      size: file.size,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      blob: file,
    }));

    if (!entityId) {
      setAttachments((prev) => {
        const next = [...prev, ...draftAttachments];
        onChange?.(next);
        return next;
      });
      return;
    }

    for (const draft of draftAttachments) {
      setUploadProgress((prev) => ({ ...prev, [draft.id]: 5 }));
      await new Promise<void>((resolve) => {
        const timer = window.setInterval(() => {
          setUploadProgress((current) => {
            const nextProgress = Math.min((current[draft.id] ?? 0) + 20, 100);
            if (nextProgress >= 100) {
              window.clearInterval(timer);
              resolve();
            }
            return { ...current, [draft.id]: nextProgress };
          });
        }, 80);
      });

      const stored = await createAttachment({
        entity_type: draft.entity_type,
        entity_id: entityId,
        filename: draft.filename,
        mime_type: draft.mime_type,
        size: draft.size,
        blob: draft.blob!,
      });

      setAttachments((prev) => {
        const next = [...prev, stored];
        onChange?.(next);
        return next;
      });
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[draft.id];
        return next;
      });
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (disabled) return;
    if (entityId && attachment.id) {
      await deleteAttachment(attachment.id);
      const next = attachments.filter((item) => item.id !== attachment.id);
      setAttachments(next);
      onChange?.(next);
      return;
    }
    const next = attachments.filter((item) => item.id !== attachment.id);
    setAttachments(next);
    onChange?.(next);
  };

  const handleDownload = (attachment: Attachment) => {
    const blob = attachment.blob;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = attachment.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handlePreview = (attachment: Attachment) => {
    if (!attachment.blob) return;
    const url = URL.createObjectURL(attachment.blob);
    setPreview({ url, filename: attachment.filename });
  };

  const clearPreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview.url);
      setPreview(null);
    }
  };

  const showEmpty = attachments.length === 0 && Object.keys(uploadProgress).length === 0;

  return (
    <div className="space-y-4">
      <label
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
        className={`block rounded-3xl border border-dashed p-5 text-center transition ${disabled ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 bg-slate-50 hover:border-brand-500 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-400'} cursor-pointer`}
      >
        <div className="flex flex-col items-center justify-center gap-3 px-2 py-10">
          <UploadCloud size={34} className="text-slate-500" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Glissez-déposez vos fichiers ici</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Images ou PDF. Taille max {maxSizeMB} Mo.</p>
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            disabled={disabled}
            className="hidden"
            onChange={(event) => {
              if (!event.target.files) return;
              handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      </label>

      {error && <p className="text-sm text-error-600 dark:text-error-300">{error}</p>}

      <div className="grid gap-3">
        {showEmpty ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Aucune pièce jointe pour le moment.
          </div>
        ) : (
          attachments.map((attachment) => {
            const isImage = attachment.mime_type.startsWith('image/');
            const progress = uploadProgress[attachment.id];
            return (
              <div key={attachment.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {isImage ? <Image size={20} /> : <FileText size={20} />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{attachment.filename}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatBytes(attachment.size)} · {new Date(attachment.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isImage && (
                      <Button type="button" variant="secondary" size="sm" onClick={() => handlePreview(attachment)}>
                        <Eye size={16} /> Voir
                      </Button>
                    )}
                    <Button type="button" variant="secondary" size="sm" onClick={() => handleDownload(attachment)}>
                      <Download size={16} /> Télécharger
                    </Button>
                    <Button type="button" variant="danger" size="sm" onClick={() => handleDelete(attachment)}>
                      <Trash2 size={16} /> Supprimer
                    </Button>
                  </div>
                </div>
                {progress !== undefined && progress < 100 && (
                  <div className="mt-3 rounded-full bg-slate-100 h-2 overflow-hidden dark:bg-slate-700">
                    <div className="h-2 rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Modal open={Boolean(preview)} onClose={clearPreview} title={preview?.filename} size="xl">
        {preview && <img src={preview.url} alt={preview.filename} className="w-full rounded-3xl" />}
      </Modal>
    </div>
  );
}
