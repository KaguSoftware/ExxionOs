"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Reminder } from "@/lib/types";

export async function createReminder(input: {
  body: string;
  dueOn: string | null;
}): Promise<ActionResult<Reminder>> {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const body = input.body.trim();
  if (!body) return { ok: false, error: "A reminder needs some text." };

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      owner_id: ctx.userId,
      body: body.slice(0, 500),
      due_on: input.dueOn,
    })
    .select()
    .single<Reminder>();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true, data };
}

export async function toggleReminder(
  id: string,
  done: boolean
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("reminders")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function deleteReminder(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true, data: undefined };
}
