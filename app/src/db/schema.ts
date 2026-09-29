import { pgTable, serial, text, integer, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['CUSTOMER', 'SELLER', 'ADMIN'])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  // Intentionally weak hashing arrives in M5; P0 stores a plain marker hash.
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('CUSTOMER'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  priceCents: integer('price_cents').notNull(),
  imageUrl: text('image_url'),
})

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  totalCents: integer('total_cents').notNull(),
  status: text('status').notNull().default('PAID'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  productId: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
})

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  numberLabel: text('number_label').notNull(),
})

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  userId: integer('user_id').notNull().references(() => users.id),
  // Stored raw on purpose (M2 stored XSS). Rendering is where the flaw shows.
  body: text('body').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  // Discount rules merged with lib/merge.ts (M2 prototype pollution).
  rules: jsonb('rules').notNull().default({}),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Product = typeof products.$inferSelect
export type Order = typeof orders.$inferSelect
