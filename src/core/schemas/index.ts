import { z } from 'zod';

export const BaseEntitySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number().default(1),
});

export type BaseEntity = z.infer<typeof BaseEntitySchema>;

export const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type Priority = z.infer<typeof PrioritySchema>;

export const TaskSchema = BaseEntitySchema.extend({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: PrioritySchema.default('medium'),
  completed: z.boolean().default(false),
  dueAt: z.string().optional(),
  tags: z.array(z.string()).default([]),
  projectId: z.string().optional(),
  goalId: z.string().optional(),
  deletedAt: z.string().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  completed: z.boolean().default(false),
  dueAt: z.string().optional(),
});

export const GoalStatusSchema = z.enum(['active', 'paused', 'completed', 'abandoned']);
export type GoalStatus = z.infer<typeof GoalStatusSchema>;
export const GoalSchema = BaseEntitySchema.extend({
  title: z.string().min(1),
  description: z.string().optional(),
  progress: z.number().min(0).max(100).default(0),
  status: GoalStatusSchema.default('active'),
  startDate: z.string().optional(),
  dueAt: z.string().optional(),
  milestones: z.array(MilestoneSchema).default([]),
});
export type Goal = z.infer<typeof GoalSchema>;

export const HabitFrequencySchema = z.enum(['daily', 'weekly']);
export const HabitSchema = BaseEntitySchema.extend({
  name: z.string().min(1),
  frequency: HabitFrequencySchema.default('daily'),
  color: z.string().default('#6366f1'),
  archived: z.boolean().default(false),
  targetPerWeek: z.number().default(7),
});
export type Habit = z.infer<typeof HabitSchema>;

export const HabitLogSchema = BaseEntitySchema.extend({
  habitId: z.string(),
  date: z.string(),
  completed: z.boolean().default(true),
  mood: z.number().min(1).max(5).optional(),
  note: z.string().optional(),
});
export type HabitLog = z.infer<typeof HabitLogSchema>;

export const JournalEntrySchema = BaseEntitySchema.extend({
  date: z.string(),
  content: z.string().min(1),
  mood: z.number().min(1).max(5).optional(),
  tags: z.array(z.string()).default([]),
  title: z.string().optional(),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const CalendarEventSchema = BaseEntitySchema.extend({
  title: z.string().min(1),
  startAt: z.string(),
  endAt: z.string().optional(),
  allDay: z.boolean().default(false),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']).default('none'),
  color: z.string().default('#3b82f6'),
  notes: z.string().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const FocusSessionSchema = BaseEntitySchema.extend({
  duration: z.number().min(1),
  taskIds: z.array(z.string()).default([]),
  goalId: z.string().optional(),
  completed: z.boolean().default(true),
  startedAt: z.string(),
  endedAt: z.string().optional(),
});
export type FocusSession = z.infer<typeof FocusSessionSchema>;

export const JobPhaseSchema = z.enum(['research', 'applied', 'interview', 'offer', 'rejected', 'closed']);
export type JobPhase = z.infer<typeof JobPhaseSchema>;
export const JobApplicationSchema = BaseEntitySchema.extend({
  company: z.string().min(1),
  role: z.string().min(1),
  url: z.string().optional(),
  phase: JobPhaseSchema.default('research'),
  salary: z.string().optional(),
  dueAt: z.string().optional(),
  notes: z.array(z.string()).default([]),
  history: z.array(z.object({
    from: JobPhaseSchema,
    to: JobPhaseSchema,
    at: z.string(),
    note: z.string().optional(),
  })).default([]),
});
export type JobApplication = z.infer<typeof JobApplicationSchema>;

export const OfferCategorySchema = z.enum([
  'Obst & Gemüse', 'Fleisch & Wurst', 'Milch & Käse', 'Brot & Backwaren',
  'Tiefkühl', 'Getränke', 'Süßigkeiten', 'Haushalt', 'Körperpflege', 'Sonstiges'
]);
export type OfferCategory = z.infer<typeof OfferCategorySchema>;
export const OfferSchema = BaseEntitySchema.extend({
  productName: z.string().min(1),
  store: z.string(),
  price: z.number().min(0),
  originalPrice: z.number().optional(),
  expiry: z.string().optional(),
  category: OfferCategorySchema.default('Sonstiges'),
  imageRef: z.string().optional(),
});
export type Offer = z.infer<typeof OfferSchema>;

export const ChatMessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export const ChatMessageSchema = BaseEntitySchema.extend({
  role: ChatMessageRoleSchema,
  content: z.string(),
  toolCalls: z.array(z.any()).default([]),
  provider: z.string().optional(),
  model: z.string().optional(),
  tokens: z.number().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const AiActionLogSchema = BaseEntitySchema.extend({
  action: z.string(),
  entity: z.string(),
  entityId: z.string().optional(),
  before: z.any().optional(),
  after: z.any().optional(),
  success: z.boolean(),
  error: z.string().optional(),
});
export type AiActionLog = z.infer<typeof AiActionLogSchema>;

export const UserProfileSchema = BaseEntitySchema.extend({
  name: z.string().default(''),
  values: z.array(z.string()).default([]),
  energyTimes: z.array(z.string()).default([]),
  stressFactors: z.array(z.string()).default([]),
  communicationStyle: z.string().default('balanced'),
  interests: z.array(z.string()).default([]),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const SettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.enum(['de', 'en']).default('de'),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
  aiApiKey: z.string().optional(),
  aiBaseUrl: z.string().optional(),
  tokenBudget: z.number().default(4000),
  rateLimitPerMinute: z.number().default(10),
  aiWriteEnabled: z.record(z.string(), z.boolean()).default({}),
  schemaVersion: z.number().default(1),
});
export type Settings = z.infer<typeof SettingsSchema>;
