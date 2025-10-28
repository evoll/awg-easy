import { sql, relations } from 'drizzle-orm';
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { userConfig, hooks } from '../../schema';

// maybe support multiple interfaces in the future
export const wgInterface = sqliteTable('interfaces_table', {
  name: text().primaryKey(),
  device: text().notNull(),
  port: int().notNull().unique(),
  privateKey: text('private_key').notNull(),
  publicKey: text('public_key').notNull(),
  ipv4Cidr: text('ipv4_cidr').notNull(),
  ipv6Cidr: text('ipv6_cidr').notNull(),
  mtu: int().notNull(),
  // does nothing yet
  enabled: int({ mode: 'boolean' }).notNull(),
  // AmneziaWG obfuscation parameters (AWG 1.0)
  // Defaults within recommended ranges from Amnezia docs
  jc: int().notNull().default(8), // Recommended: 4-12
  jmin: int().notNull().default(8), // Recommended: 8
  jmax: int().notNull().default(80), // Recommended: 80
  s1: int().notNull().default(50), // Recommended: 15-150
  s2: int().notNull().default(85), // Recommended: 15-150 (50+56≠85 ✓)
  s3: int().notNull().default(0), // Cookie header junk size
  s4: int().notNull().default(0), // Transport header junk size
  h1: int().notNull().default(1376979037),
  h2: int().notNull().default(1283620850),
  h3: int().notNull().default(917053776),
  h4: int().notNull().default(696394151),
  // AmneziaWG 1.5 advanced obfuscation parameters
  // I1 defaults to QUIC packet for traffic obfuscation
  // Use empty default to avoid huge inline literal here (keeps schema readable)
  i1: text().notNull().default(''), // Special junk packet 1 (QUIC mimic format <b 0x....>)
  i2: text().notNull().default(''), // Special junk packet 2
  i3: text().notNull().default(''), // Special junk packet 3
  i4: text().notNull().default(''), // Special junk packet 4
  i5: text().notNull().default(''), // Special junk packet 5
  j1: text().notNull().default(''), // Junk packet schedule 1
  j2: text().notNull().default(''), // Junk packet schedule 2
  j3: text().notNull().default(''), // Junk packet schedule 3
  itime: int().notNull().default(0), // Interval time
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export const wgInterfaceRelations = relations(wgInterface, ({ one }) => ({
  hooks: one(hooks, {
    fields: [wgInterface.name],
    references: [hooks.id],
  }),
  userConfig: one(userConfig, {
    fields: [wgInterface.name],
    references: [userConfig.id],
  }),
}));