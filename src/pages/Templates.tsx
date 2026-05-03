import { useEffect, useMemo, useState } from 'react';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { t } from '@/lib/i18n';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import type { MessageTemplate } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TemplatesPageProps {
  lang: string;
}

const DEFAULT_TEMPLATES: Array<Pick<MessageTemplate, 'name' | 'body'>> = [
  {
    name: 'Client Follow-Up',
    body: 'Hi {name}, just following up on your request. Reply YES and we will call you today.',
  },
  {
    name: 'Payment Reminder',
    body: 'Hello {name}, this is a reminder that your payment is due on Friday. Thank you.',
  },
];

export default function TemplatesPage({ lang }: TemplatesPageProps) {
  const { settings, update } = useAppSettings();
  const templatesQuery = useLiveQuery(() => db.templates.orderBy('updatedAt').reverse().toArray(), []);
  const templates = useMemo(() => templatesQuery ?? [], [templatesQuery]);
  const [customVariableKey, setCustomVariableKey] = useState('');
  const [customVariableValue, setCustomVariableValue] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const customVariables = useMemo(() => settings.customVariables ?? [], [settings.customVariables]);

  useEffect(() => {
    if (templatesQuery === undefined || templatesQuery.length > 0) return;

    const now = new Date();
    void db.templates.bulkAdd(
      DEFAULT_TEMPLATES.map((template) => ({
        name: template.name,
        body: template.body,
        placeholders: extractPlaceholders(template.body),
        createdAt: now,
        updatedAt: now,
      }))
    );
  }, [templatesQuery]);

  function normalizeVariableKey(value: string): string {
    return value.trim().replace(/[{}]/g, '').replace(/\s+/g, '_');
  }

  async function addCustomVariable() {
    const key = normalizeVariableKey(customVariableKey);
    const value = customVariableValue.trim();
    const builtInKeys = new Set(['name', 'phone', 'location']);
    if (!key) {
      toast({ title: 'Invalid variable', description: 'Variable key is required.' });
      return;
    }
    if (builtInKeys.has(key.toLowerCase())) {
      toast({ title: 'Reserved variable', description: 'This key is already used by a built-in variable.' });
      return;
    }
    if (customVariables.some((item) => item.key.toLowerCase() === key.toLowerCase())) {
      toast({ title: 'Duplicate variable', description: 'This custom variable key already exists.' });
      return;
    }
    await update({ customVariables: [...customVariables, { key, value }] });
    setCustomVariableKey('');
    setCustomVariableValue('');
  }

  async function removeCustomVariable(key: string) {
    await update({ customVariables: customVariables.filter((item) => item.key !== key) });
  }

  function extractPlaceholders(body: string): string[] {
    const matches = body.match(/\{([a-zA-Z0-9_]+)\}/g) ?? [];
    return Array.from(new Set(matches.map((match) => match.replace(/[{}]/g, '').trim()).filter(Boolean)));
  }

  function openCreateDialog() {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateBody('');
    setDialogOpen(true);
  }

  function openEditDialog(template: MessageTemplate) {
    setEditingTemplateId(template.id ?? null);
    setTemplateName(template.name);
    setTemplateBody(template.body);
    setDialogOpen(true);
  }

  async function saveTemplate() {
    const name = templateName.trim();
    const body = templateBody.trim();
    if (!name || !body) {
      toast({ title: 'Missing fields', description: 'Template name and body are required.' });
      return;
    }

    const now = new Date();
    if (editingTemplateId) {
      await db.templates.update(editingTemplateId, {
        name,
        body,
        placeholders: extractPlaceholders(body),
        updatedAt: now,
      });
      toast({ title: 'Template updated' });
    } else {
      await db.templates.add({
        name,
        body,
        placeholders: extractPlaceholders(body),
        createdAt: now,
        updatedAt: now,
      });
      toast({ title: 'Template created' });
    }

    setDialogOpen(false);
  }

  async function deleteTemplate(templateId: number) {
    await db.templates.delete(templateId);
    toast({ title: 'Template deleted' });
  }

  return (
    <div className="min-h-screen bg-background px-5 pb-5 pt-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('templates', lang)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create and manage your reusable message templates.</p>
      </div>

      <div className="flex max-h-[calc(100vh-170px)] flex-col">
        <div className="mb-3">
          <Button type="button" onClick={openCreateDialog} className="h-11 rounded-full px-5 font-semibold">
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto pb-5 pr-1">
          <div className="space-y-3">
            {templates.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-card p-6 text-sm text-muted-foreground">
                No templates yet.
              </div>
            )}
            {templates.map((tmpl) => (
              <motion.div
                key={tmpl.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[24px] border border-border/50 bg-card p-5"
              >
                <div className="mb-3 flex items-start justify-between">
                  <p className="text-[16px] font-bold text-foreground">{tmpl.name}</p>
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="mb-3 text-sm font-medium leading-relaxed text-muted-foreground">{tmpl.body}</p>
                <div className="border-t border-border/50 pt-3">
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {tmpl.placeholders.map((p) => (
                      <span
                        key={p}
                        className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground"
                      >
                        +{p}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full"
                      onClick={() => openEditDialog(tmpl)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => void deleteTemplate(tmpl.id!)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div
          className="sticky bottom-0 mt-3 rounded-[24px] border border-border/50 bg-card p-5 shadow-[0_-8px_30px_hsl(var(--background)/0.92)]"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <p className="text-sm font-bold text-foreground">Custom Variables</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create variables here and use them in messages as {'{variable_key}'}.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              placeholder="Variable key (e.g promo_code)"
              value={customVariableKey}
              onChange={(event) => setCustomVariableKey(event.target.value)}
            />
            <Input
              placeholder="Value"
              value={customVariableValue}
              onChange={(event) => setCustomVariableValue(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={() => void addCustomVariable()} disabled={!customVariableKey.trim()}>
              Add
            </Button>
          </div>
          {customVariables.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {customVariables.map((variable) => (
                <button
                  key={variable.key}
                  type="button"
                  onClick={() => void removeCustomVariable(variable.key)}
                  className="rounded-full border border-border bg-secondary px-3 py-1.5 text-[11px] font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                  {variable.key} = {variable.value || '""'} x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>{editingTemplateId ? 'Edit Template' : 'Create Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Template name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
            <Textarea
              placeholder="Template body"
              className="min-h-[120px]"
              value={templateBody}
              onChange={(event) => setTemplateBody(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveTemplate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
