/**
 * Regras puras de vínculo user ↔ instructor (sem I/O).
 */

export type LinkUserError =
  | "invalid_user_id"
  | "not_member"
  | "wrong_role"
  | "already_linked_elsewhere"
  | "instructor_already_linked";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function evaluateLinkUser(input: {
  accountId: string;
  instructorUserId: string | null;
  /** Perfil do usuário alvo (mesma conta esperada). */
  targetProfile: {
    account_id: string;
    account_role: string;
  } | null;
  /** Se o user_id já está em outro instructor desta conta. */
  otherInstructorId: string | null;
}): { ok: true } | { ok: false; error: LinkUserError; message: string } {
  if (input.instructorUserId) {
    return {
      ok: false,
      error: "instructor_already_linked",
      message: "Este instrutor já possui usuário vinculado",
    };
  }
  if (!input.targetProfile) {
    return {
      ok: false,
      error: "not_member",
      message: "Usuário não encontrado nesta conta",
    };
  }
  if (input.targetProfile.account_id !== input.accountId) {
    return {
      ok: false,
      error: "not_member",
      message: "Usuário não pertence a esta conta",
    };
  }
  if (input.targetProfile.account_role !== "instructor") {
    return {
      ok: false,
      error: "wrong_role",
      message: "O usuário precisa ter o papel instructor",
    };
  }
  if (input.otherInstructorId) {
    return {
      ok: false,
      error: "already_linked_elsewhere",
      message: "Este usuário já está vinculado a outro instrutor",
    };
  }
  return { ok: true };
}
