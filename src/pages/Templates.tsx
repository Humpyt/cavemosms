import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { MessageTemplate } from '@/lib/types';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, FileText, Edit2, Trash2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TemplatesPageProps {
  lang: string;
}

export default function TemplatesPage({ lang }: TemplatesPageProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [formName, setFormName] = useState('');
  const [formBody, setFormBody] = useState('');

  const templates = useLiveQuery(() => db.templates.toArray()) || [];

  function openNew() {
    setEditing(null);
    setFormName('');
    setFormBody('');
    setDialogOpen(true);
  }

  function openEdit(tmpl: MessageTemplate) {
    setEditing(tmpl);
    setFormName(tmpl.name);
    setFormBody(tmpl.body);
    setDialogOpen(true);
  }

  async function save() {
    const placeholders = (formBody.match(/\{(\w+)\}/g) || []).map((p) => p.replace(/[{}]/g, ''));
    const now = new Date();

    if (editing) {
      await db.templates.update(editing.id!, {
        name: formName,
        body: formBody,
        placeholders,
        updatedAt: now,
      });
    } else {
      await db.templates.add({
        name: formName,
        body: formBody,
        placeholders,
        createdAt: now,
        updatedAt: now,
      });
    }
    setDialogOpen(false);
  }

  async function duplicate(tmpl: MessageTemplate) {
    await db.templates.add({
      name: `${tmpl.name} (copy)`,
      body: tmpl.body,
      placeholders: tmpl.placeholders,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async function remove(id: number) {
    await db.templates.delete(id);
  }

  return (
    <div className="px-5 pb-32 pt-8 min-h-screen bg-background">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('templates', lang)}</h1>
          <p className="text-sm text-muted-foreground mt-1">Saved campaign messages.</p>
        </div>
        <button 
          onClick={openNew}
          className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {templates.length === 0 ? (
            <div className="bg-card rounded-[24px] border border-dashed border-border/80 flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 opacity-50" />
              </div>
              <p className="text-sm font-medium mb-3">{t('noTemplates', lang)}</p>
              <button 
                className="px-6 py-2.5 rounded-full bg-secondary text-secondary-foreground text-sm font-bold transition-colors hover:bg-secondary/80" 
                onClick={openNew}
              >
                {t('addTemplate', lang)}
              </button>
            </div>
          ) : (
            templates.map((tmpl) => (
              <motion.div
                key={tmpl.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="bg-card rounded-[24px] p-5 border border-border/50 hover:border-border transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-[16px] font-bold text-foreground">{tmpl.name}</p>
                    <div className="flex gap-1 bg-secondary rounded-full p-1">
                      <button className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-background hover:text-foreground transition-all" onClick={() => duplicate(tmpl)}>
                        <Copy className="w-4 h-4" />
                      </button>
                      <button className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-background hover:text-foreground transition-all" onClick={() => openEdit(tmpl)}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="w-8 h-8 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-all" onClick={() => remove(tmpl.id!)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground line-clamp-3 leading-relaxed mb-3">
                    {tmpl.body}
                  </p>
                  {tmpl.placeholders.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/50">
                      {tmpl.placeholders.map((p) => (
                        <span
                          key={p}
                          className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold uppercase tracking-wider"
                        >
                          +{p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[32px] p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">
              {editing ? t('edit', lang) : t('addTemplate', lang)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={t('templateName', lang)}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="h-14 rounded-2xl bg-secondary border-0 text-[15px] px-4"
            />
            <div className="bg-secondary rounded-[24px] p-2 focus-within:ring-1 focus-within:ring-primary transition-all">
              <Textarea
                placeholder={t('messageBody', lang)}
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                className="min-h-[140px] resize-none bg-transparent border-0 focus-visible:ring-0 p-3 text-[15px]"
              />
              <div className="flex gap-2 mt-2 p-2 border-t border-border/30 overflow-x-auto no-scrollbar">
                {['name', 'phone', 'location'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setFormBody((prev) => prev + `{${p}}`)}
                    className="px-3 py-1.5 rounded-full bg-background text-foreground text-[11px] font-bold shadow-sm hover:text-primary transition-colors whitespace-nowrap shrink-0"
                  >
                    +{p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <button 
              onClick={save} 
              disabled={!formName.trim() || !formBody.trim()}
              className="w-full h-14 rounded-full bg-primary text-primary-foreground font-bold text-[15px] disabled:opacity-50"
            >
              {t('save', lang)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
