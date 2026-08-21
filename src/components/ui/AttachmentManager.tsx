import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Eye, FileText, Image, Trash2, UploadCloud } from 'lucide-react';
import type { Attachment, AttachmentEntityType } from '../../lib/types';
import { createAttachment, deleteAttachment, getAttachmentsByEntity } from '../../lib/data';
import { generateId, formatDate } from '../../lib/format';
import { Button } from './Button';
import { Modal } from './Modal';
import { useToast } from '../../context/ToastContext';

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
  if (!bytes || isNaN(bytes)) return '0 B';
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
  const { addToast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<{
    url: string;
    filename: string;
    mime_type: string;
    isTempUrl: boolean;
  } | null>(null);
  const intervalsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const intervals = intervalsRef.current;
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
      intervals.forEach((timer) => window.clearInterval(timer));
      intervals.clear();
    };
  }, [entityId, entityType, initialAttachments, onChange]);

  const handleFiles = async (files: FileList | File[]) => {
    if (disabled) return;
    setError('');
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      if (!isAcceptedFile(file)) {
        setError('Seuls les fichiers images (JPG, PNG...) et PDF sont acceptés.');
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
      id: generateId(),
      entity_type: entityType,
      entity_id: entityId ?? '',
      filename: file.name,
      mime_type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
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
      addToast({
        type: 'success',
        title: 'Pièce jointe ajoutée',
        description: `${validFiles.length} fichier(s) prêt(s) à être enregistré(s).`,
      });
      return;
    }

    for (const draft of draftAttachments) {
      setUploadProgress((prev) => ({ ...prev, [draft.id]: 5 }));
      await new Promise<void>((resolve) => {
        const timer = window.setInterval(() => {
          setUploadProgress((current) => {
            const nextProgress = Math.min((current[draft.id] ?? 0) + 25, 100);
            if (nextProgress >= 100) {
              window.clearInterval(timer);
              intervalsRef.current.delete(draft.id);
              resolve();
            }
            return { ...current, [draft.id]: nextProgress };
          });
        }, 60);

        intervalsRef.current.set(draft.id, timer);
      });

      try {
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
        addToast({
          type: 'success',
          title: 'Fichier sauvegardé',
          description: `"${draft.filename}" a été ajouté avec succès.`,
        });
      } catch (err) {
        console.error('Erreur sauvegarde pièce jointe', err);
        addToast({
          type: 'error',
          title: 'Erreur',
          description: `Impossible de sauvegarder "${draft.filename}".`,
        });
      } finally {
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[draft.id];
          return next;
        });
      }
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (disabled) return;
    try {
      if (entityId && attachment.id) {
        await deleteAttachment(attachment.id);
      }
      const next = attachments.filter((item) => item.id !== attachment.id);
      setAttachments(next);
      onChange?.(next);
      addToast({
        type: 'info',
        title: 'Pièce jointe supprimée',
        description: `"${attachment.filename}" a été retirée.`,
      });
    } catch (err) {
      console.error('Erreur suppression pièce jointe', err);
      addToast({
        type: 'error',
        title: 'Erreur',
        description: 'Impossible de supprimer cette pièce jointe.',
      });
    }
  };

  const handleDownload = (attachment: Attachment) => {
    let url: string | null = null;
    let shouldRevoke = false;

    if (attachment.blob) {
      url = URL.createObjectURL(attachment.blob);
      shouldRevoke = true;
    } else if (attachment.url) {
      url = attachment.url;
    }

    if (!url) {
      addToast({
        type: 'error',
        title: 'Fichier non disponible',
        description: 'Le contenu du fichier n’est pas accessible pour le téléchargement.',
      });
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = attachment.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    if (shouldRevoke) {
      setTimeout(() => URL.revokeObjectURL(url!), 1000);
    }
  };

  const handlePreview = (attachment: Attachment) => {
    let url: string | null = null;
    let isTempUrl = false;

    if (attachment.blob) {
      url = URL.createObjectURL(attachment.blob);
      isTempUrl = true;
    } else if (attachment.url) {
      url = attachment.url;
    }

    if (!url) {
      addToast({
        type: 'error',
        title: 'Aperçu non disponible',
        description: 'Impossible de générer l’aperçu de ce fichier.',
      });
      return;
    }

    setPreview({
      url,
      filename: attachment.filename,
      mime_type: attachment.mime_type,
      isTempUrl,
    });
  };

  const clearPreview = () => {
    if (preview) {
      if (preview.isTempUrl) {
        URL.revokeObjectURL(preview.url);
      }
      setPreview(null);
    }
  };

  const showEmpty = attachments.length === 0 && Object.keys(uploadProgress).length === 0;

  return (
    <div className="space-y-4">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={`block rounded-2xl border-2 border-dashed p-5 text-center transition cursor-pointer ${
          disabled
            ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
            : isDragging
            ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 dark:border-brand-400'
            : 'border-slate-300 bg-slate-50/70 hover:border-brand-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-brand-500 dark:hover:bg-slate-800/80'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2.5 px-2 py-6">
          <div className="p-3 rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            <UploadCloud size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Glissez-déposez vos fichiers ici, ou <span className="text-brand-600 dark:text-brand-400 underline">parcourir</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Images (PNG, JPG, WEBP) ou documents PDF · Max {maxSizeMB} Mo par fichier
            </p>
          </div>
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

      {error && <p className="text-sm font-medium text-error-600 dark:text-error-400">{error}</p>}

      <div className="grid gap-3">
        {showEmpty ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            Aucune pièce jointe associées pour le moment.
          </div>
        ) : (
          attachments.map((attachment) => {
            const isImage = attachment.mime_type.startsWith('image/');
            const isPdf = attachment.mime_type === 'application/pdf' || attachment.filename.endsWith('.pdf');
            const progress = uploadProgress[attachment.id];

            return (
              <div
                key={attachment.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700/80 dark:bg-slate-800/90 transition hover:border-slate-300 dark:hover:border-slate-600"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      isImage
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : isPdf
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {isImage ? <Image size={20} /> : <FileText size={20} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate" title={attachment.filename}>
                        {attachment.filename}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatBytes(attachment.size)} · {formatDate(attachment.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {(isImage || isPdf) && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePreview(attachment)}
                        title="Prévisualiser la pièce jointe"
                      >
                        <Eye size={15} /> Voir
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(attachment)}
                      title="Télécharger la pièce jointe"
                    >
                      <Download size={15} /> Télécharger
                    </Button>
                    {!disabled && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(attachment)}
                        title="Supprimer la pièce jointe"
                      >
                        <Trash2 size={15} /> Supprimer
                      </Button>
                    )}
                  </div>
                </div>

                {progress !== undefined && progress < 100 && (
                  <div className="mt-3 rounded-full bg-slate-100 h-1.5 overflow-hidden dark:bg-slate-700">
                    <div
                      className="h-1.5 rounded-full bg-brand-500 transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Modal open={Boolean(preview)} onClose={clearPreview} title={preview?.filename || 'Aperçu du fichier'} size="xl">
        {preview && (
          <div className="space-y-4">
            {preview.mime_type.startsWith('image/') ? (
              <div className="flex justify-center bg-slate-900/5 dark:bg-slate-900/40 p-2 rounded-2xl">
                <img
                  src={preview.url}
                  alt={preview.filename}
                  className="max-h-[70vh] w-auto object-contain rounded-xl shadow-md"
                />
              </div>
            ) : preview.mime_type === 'application/pdf' || preview.filename.endsWith('.pdf') ? (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    <ExternalLink size={14} /> Ouvrir dans un nouvel onglet
                  </a>
                </div>
                <iframe
                  src={preview.url}
                  title={preview.filename}
                  className="w-full h-[65vh] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner"
                />
              </div>
            ) : (
              <div className="py-10 text-center text-slate-500">
                <p>Aperçu indisponible pour ce type de fichier.</p>
                <a
                  href={preview.url}
                  download={preview.filename}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
                >
                  <Download size={16} /> Télécharger le fichier
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
