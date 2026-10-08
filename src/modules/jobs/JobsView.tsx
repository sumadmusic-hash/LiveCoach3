import { useState, useEffect } from 'react';
import { jobRepository } from '../../core/db/repositories';
import type { JobApplication, JobPhase } from '../../core/schemas';
import { Plus, Briefcase, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const phases: { id: JobPhase; label: string; color: string }[] = [
  { id: 'research', label: 'Recherche', color: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' },
  { id: 'applied', label: 'Beworben', color: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700' },
  { id: 'interview', label: 'Interview', color: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700' },
  { id: 'offer', label: 'Angebot', color: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700' },
  { id: 'rejected', label: 'Absage', color: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700' },
  { id: 'closed', label: 'Erledigt', color: 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600' },
];

function DraggableCard({ job }: { job: JobApplication }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: job.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  return (
    <div ref={setNodeRef} style={style} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-2 shadow-sm cursor-grab active:cursor-grabbing">
      <div className="flex items-start gap-2" {...attributes} {...listeners}>
        <GripVertical size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{job.role}</p>
          <p className="text-xs text-gray-500">{job.company}</p>
          {job.salary && <p className="text-xs text-green-600 mt-1">{job.salary}</p>}
          {job.dueAt && <p className="text-[10px] text-orange-500 mt-1">Frist: {new Date(job.dueAt).toLocaleDateString('de-DE')}</p>}
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({ phase, jobs, children }: { phase: typeof phases[0]; jobs: JobApplication[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.id });
  return (
    <div ref={setNodeRef} className={`flex-1 min-w-[200px] rounded-xl border-2 border-dashed p-3 transition-colors ${isOver ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className={`rounded-lg p-2 mb-2 border ${phase.color}`}>
        <p className="text-xs font-semibold text-center">{phase.label} ({jobs.length})</p>
      </div>
      {children}
    </div>
  );
}

export default function JobsView() {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [url, setUrl] = useState('');
  const [salary, setSalary] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const j = await jobRepository.getAll();
    setJobs(j);
    setLoading(false);
  }

  async function createJob() {
    if (!company.trim() || !role.trim()) return;
    await jobRepository.create({ company: company.trim(), role: role.trim(), url: url || undefined, salary: salary || undefined, phase: 'research', notes: [], history: [] });
    setCompany(''); setRole(''); setUrl(''); setSalary(''); setShowForm(false);
    load();
    toast.success('Bewerbung erstellt');
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const jobId = active.id as string;
    const newPhase = over.id as JobPhase;
    await jobRepository.update(jobId, { phase: newPhase });
    load();
  }

  async function deleteJob(id: string) {
    await jobRepository.delete(id);
    load();
  }

  if (loading) return <div className="animate-pulse h-64 bg-gray-200 dark:bg-gray-700 rounded" />;

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">JobBoard</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus size={16} /> Neu
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Firma" className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="Rolle" className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
          </div>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Link zur Stelle" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
          <input value={salary} onChange={e => setSalary(e.target.value)} placeholder="Gehalt (optional)" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" />
          <button onClick={createJob} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Erstellen</button>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Briefcase size={48} className="mx-auto mb-3 opacity-50" />
          <p>Noch keine Bewerbungen</p>
        </div>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {phases.map(phase => {
              const phaseJobs = jobs.filter(j => j.phase === phase.id);
              return (
                <DroppableColumn key={phase.id} phase={phase} jobs={phaseJobs}>
                  {phaseJobs.map(job => (
                    <div key={job.id} className="relative group">
                      <DraggableCard job={job} />
                      <button onClick={() => deleteJob(job.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  ))}
                </DroppableColumn>
              );
            })}
          </div>
        </DndContext>
      )}
    </div>
  );
}
