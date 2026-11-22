import { pgTable, uuid, text, boolean, timestamp, integer, numeric, jsonb, unique, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  authSubject: text("auth_subject").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phoneE164: text("phone_e164").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contactConsent = pgTable("contact_consent", {
  id: uuid("id").defaultRandom().primaryKey(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  status: text("consent_status").notNull(),
  source: text("consent_source"),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("contact_consent_contact_idx").on(t.contactId)]);

export const contactGroups = pgTable("contact_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const contactGroupMembers = pgTable("contact_group_members", {
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").notNull().references(() => contactGroups.id, { onDelete: "cascade" }),
}, t => [unique().on(t.contactId, t.groupId)]);

export const campaigns = pgTable("message_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  messageTe: text("message_te"),
  messageEn: text("message_en"),
  messageType: text("message_type").notNull().default("PUBLIC_INFORMATION"),
  status: text("status").notNull().default("DRAFT"),
  budgetInr: numeric("budget_inr", { precision: 10, scale: 2 }).notNull().default("0"),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignRecipients = pgTable("campaign_recipients", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  status: text("status").notNull().default("PENDING"),
  whatsappMessageId: text("whatsapp_message_id"),
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 4 }).notNull().default("0"),
  actualCost: numeric("actual_cost", { precision: 10, scale: 4 }),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, t => [unique().on(t.campaignId, t.contactId)]);

export const messageLogs = pgTable("message_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipientId: uuid("recipient_id").references(() => campaignRecipients.id),
  eventType: text("event_type").notNull(),
  eventData: jsonb("event_data").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
