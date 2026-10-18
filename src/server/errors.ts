export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export const isUniqueViolation = (e: unknown) =>
  e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
