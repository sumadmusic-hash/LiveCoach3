import { useState, useEffect } from 'react';
import { profileRepository } from '../../core/db/repositories';
import type { UserProfile } from '../../core/schemas';
import { User, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfileView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [values, setValues] = useState('');
  const [energyTimes, setEnergyTimes] = useState('');
  const [stressFactors, setStressFactors] = useState('');
  const [interests, setInterests] = useState('');
  const [commStyle, setCommStyle] = useState('balanced');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const p = await profileRepository.get();
    if (p) {
      setProfile(p);
      setName(p.name);
      setValues(p.values.join(', '));
      setEnergyTimes(p.energyTimes.join(', '));
      setStressFactors(p.stressFactors.join(', '));
      setInterests(p.interests.join(', '));
      setCommStyle(p.communicationStyle);
    }
    setLoading(false);
  }

  async function save() {
    await profileRepository.save({
      name: name.trim(),
      values: values.split(',').map(v => v.trim()).filter(Boolean),
      energyTimes: energyTimes.split(',').map(v => v.trim()).filter(Boolean),
      stressFactors: stressFactors.split(',').map(v => v.trim()).filter(Boolean),
      interests: interests.split(',').map(v => v.trim()).filter(Boolean),
      communicationStyle: commStyle,
    });
    toast.success('Profil gespeichert');
  }

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 md:pb-0">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <User size={32} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Profil</h1>
          <p className="text-sm text-gray-500">Dein persönliches Profil für die KI</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Dein Name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Werte</label>
          <input value={values} onChange={e => setValues(e.target.value)} placeholder="z.B. Familie, Gesundheit, Lernen" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
          <p className="text-xs text-gray-400 mt-1">Kommagetrennt</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Energiezeiten</label>
          <input value={energyTimes} onChange={e => setEnergyTimes(e.target.value)} placeholder="z.B. Morgens 8-11, Abends 20-22" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Stressfaktoren</label>
          <input value={stressFactors} onChange={e => setStressFactors(e.target.value)} placeholder="z.B. Zeitdruck, Unklarheit" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Kommunikationsstil</label>
          <select value={commStyle} onChange={e => setCommStyle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm">
            <option value="balanced">Ausgewogen</option>
            <option value="direct">Direkt & Knapp</option>
            <option value="warm">Warm & Ermutigend</option>
            <option value="analytical">Analytisch & Detailliert</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Interessen</label>
          <input value={interests} onChange={e => setInterests(e.target.value)} placeholder="z.B. Fitness, Kochen, Programmieren" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
        </div>
        <button onClick={save} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          <Save size={16} /> Speichern
        </button>
      </div>
    </div>
  );
}
