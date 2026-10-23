type SupabaseError = {
  code?: string;
  message?: string;
};

export function isMissingSupabaseTable(error: SupabaseError | null | undefined, tableName?: string): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  if (!error.message) return false;
  return tableName ? error.message.includes(tableName) : /relation .* does not exist/i.test(error.message);
}

export function getMissingSupabaseTableMessage(tableName: string): string {
  return `Falta la tabla ${tableName} en el proyecto Supabase conectado. Ejecuta deploy/supabase-schema.sql en el SQL Editor de ese mismo proyecto y vuelve a intentarlo.`;
}
