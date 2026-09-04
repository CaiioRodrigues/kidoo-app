import { z } from 'zod';

/**
 * Toda entrada do usuário passa por aqui antes de virar estado ou chamada de API.
 * Validar na borda evita payload malformado e reduz superfície de injeção.
 */

const NAME_PATTERN = /^[\p{L}][\p{L}\s'’-]{1,59}$/u;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Informe seu e-mail')
  .max(254, 'E-mail muito longo')
  .email('E-mail inválido')
  .transform((value) => value.toLowerCase());

/**
 * Mínimo de 8 caracteres com letra e número. Não exigimos símbolos: regras
 * barrocas empurram o usuário para senhas piores e reuso.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Use pelo menos 8 caracteres')
  .max(128, 'Senha muito longa')
  .regex(/[A-Za-zÀ-ÿ]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número');

export const guardianNameSchema = z.string().trim().regex(NAME_PATTERN, 'Informe um nome válido');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha'),
});

export const signUpSchema = z.object({
  name: guardianNameSchema,
  email: emailSchema,
  password: passwordSchema,
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'É preciso aceitar os termos e a política de privacidade' }),
  }),
});

/** Faixa etária atendida pelo Kidoo; também barra datas absurdas ou futuras. */
export const MIN_CHILD_AGE = 2;
export const MAX_CHILD_AGE = 17;

export const childBirthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Data inválida')
  .refine((value) => {
    const age = ageFromBirthDate(value);
    return age >= MIN_CHILD_AGE && age <= MAX_CHILD_AGE;
  }, `O Kidoo atende crianças de ${MIN_CHILD_AGE} a ${MAX_CHILD_AGE} anos`);

export const childProfileSchema = z.object({
  name: z.string().trim().regex(NAME_PATTERN, 'Informe o nome da criança'),
  birthDate: childBirthDateSchema,
  gender: z.enum(['boy', 'girl', 'undisclosed']),
  photoUri: z.string().nullable(),
});

export const childInterestsSchema = z.object({
  interests: z
    .array(z.string())
    .min(1, 'Escolha ao menos uma atividade')
    .max(9, 'Escolha até 9 atividades'),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ChildProfileInput = z.infer<typeof childProfileSchema>;

/** Idade em anos completos a partir de uma data ISO (YYYY-MM-DD). */
export function ageFromBirthDate(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/** Extrai a primeira mensagem de erro por campo, no formato usado pelos forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
