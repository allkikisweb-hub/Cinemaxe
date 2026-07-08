import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Check, Loader2, Settings as SettingsIcon, Bot, Eye, EyeOff, GripVertical } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = (await websiteApi.getSettings()) as any;
      setSettings(data.settings);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const { settings: next } = (await websiteApi.updateSettings(settings)) as any;
      setSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (id: string) => {
    setSettings((s: any) => ({
      ...s,
      homepageSections: s.homepageSections.map((sec: any) => (sec.id === id ? { ...sec, visible: !sec.visible } : sec)),
    }));
  };

  if (error) return <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>;
  if (!settings) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(57,255,20,0.2)', borderTopColor: 'var(--accent)' }} />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><SettingsIcon className="w-5 h-5" style={{ color: 'var(--accent-text)' }} /> Site Settings</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Every change here saves straight to the live website — no redeploy needed.</p>
      </div>

      <Section title="General">
        <Field label="Site Name">
          <input className="input-base" value={settings.siteName} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} />
        </Field>
        <Field label="Hero Tagline">
          <input className="input-base" value={settings.heroTagline} onChange={(e) => setSettings({ ...settings, heroTagline: e.target.value })} />
        </Field>
        <ToggleRow
          label="Maintenance Mode"
          sub="Shows a maintenance page to visitors instead of the site"
          on={settings.maintenanceMode}
          onToggle={() => setSettings({ ...settings, maintenanceMode: !settings.maintenanceMode })}
          dangerWhenOn
        />
      </Section>

      <Section title="Homepage Sections">
        <p className="text-xs -mt-1" style={{ color: 'var(--text-faint)' }}>Show or hide entire rows on the homepage.</p>
        <div className="space-y-2">
          {(settings.homepageSections || []).map((sec: any) => (
            <div key={sec.id} className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <GripVertical className="w-3.5 h-3.5" style={{ color: 'var(--text-faint)' }} />
                <span className="text-sm" style={{ color: sec.visible ? '#fff' : 'var(--text-faint)' }}>{sec.label}</span>
              </div>
              <button onClick={() => toggleSection(sec.id)} className="cursor-pointer">
                {sec.visible ? <Eye className="w-4 h-4" style={{ color: 'var(--accent-text)' }} /> : <EyeOff className="w-4 h-4" style={{ color: 'var(--text-faint)' }} />}
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="All Kiki's AI Agent" icon={Bot}>
        <ToggleRow
          label="AI Assistant Enabled"
          on={settings.aiEnabled}
          onToggle={() => setSettings({ ...settings, aiEnabled: !settings.aiEnabled })}
        />
        <Field label="Groq Model">
          <input className="input-base font-mono" placeholder="llama-3.1-8b-instant" value={settings.aiModel} onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })} />
        </Field>
        <Field label="Extra System Prompt Instructions">
          <textarea rows={4} className="input-base resize-none" placeholder="Any additional instructions appended to the assistant's system prompt..." value={settings.aiSystemPromptExtra} onChange={(e) => setSettings({ ...settings, aiSystemPromptExtra: e.target.value })} />
        </Field>
      </Section>

      <button onClick={save} disabled={saving} className="neon-btn flex items-center gap-2 font-bold px-6 py-3 rounded-xl text-xs uppercase tracking-wide cursor-pointer disabled:opacity-60">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Bot; children: ReactNode }) {
  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-bold text-white flex items-center gap-2">{Icon && <Icon className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />}{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({ label, sub, on, onToggle, dangerWhenOn }: { label: string; sub?: string; on: boolean; onToggle: () => void; dangerWhenOn?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
      <div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{sub}</p>}
      </div>
      <button
        onClick={onToggle}
        className="text-[10px] font-bold px-3 py-1 rounded-full cursor-pointer"
        style={on ? (dangerWhenOn ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444' } : { background: 'var(--accent-dim)', color: 'var(--accent-text)' }) : { background: 'rgba(255,255,255,0.05)', color: 'var(--text-faint)' }}
      >
        {on ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
