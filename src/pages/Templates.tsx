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
    <div className="pb-20 px-4 pt-2">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display font-bold">{t('templates', lang)}</h1>
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="w-4 h-4" />
          {t('addTemplate', lang)}
        </Button>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {templates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{t('noTemplates', lang)}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={openNew}>
                  {t('addTemplate', lang)}
                </Button>
              </CardContent>
            </Card>
          ) : (
            templates.map((tmpl) => (
              <motion.div
                key={tmpl.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-semibold">{tmpl.name}</p>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicate(tmpl)}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tmpl)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(tmpl.id!)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{tmpl.body}</p>
                    {tmpl.placeholders.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tmpl.placeholders.map((p) => (
                          <span
                            key={p}
                            className="px-2 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] font-medium"
                          >
                            {`{${p}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? t('edit', lang) : t('addTemplate', lang)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t('templateName', lang)}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <div>
              <Textarea
                placeholder={t('messageBody', lang)}
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              <div className="flex gap-1 mt-1.5">
                {['name', 'phone', 'location'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setFormBody((prev) => prev + `{${p}}`)}
                    className="px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground text-[10px] font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {`{${p}}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={!formName.trim() || !formBody.trim()}>
              {t('save', lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
