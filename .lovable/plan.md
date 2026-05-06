# Adicionar "Esqueceu sua senha"

Hoje a tela de Login não tem link para recuperar senha, e não existem rotas/páginas para o fluxo. Vou criar o fluxo completo usando o Supabase Auth (já configurado no projeto).

## O que será feito

1. **Novo link no Login** (`src/pages/auth/Login.tsx`)
   - Adicionar `Esqueceu sua senha?` logo abaixo do campo de Senha, alinhado à direita, levando para `/auth/forgot-password`.
   - Estilo discreto, usando tokens existentes (text-muted-foreground + hover accent), mantendo a estética O2 dark.

2. **Nova página `ForgotPassword.tsx`** (`src/pages/auth/ForgotPassword.tsx`)
   - Reusa o `AuthLayout` já exportado em `Login.tsx`.
   - Form com campo de e-mail.
   - Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/auth/reset-password" })`.
   - Mostra estado de sucesso ("Se o e-mail existir, enviamos um link…") sem revelar se o e-mail existe (boa prática).
   - Toast de erro em caso de falha de rede.
   - Link de volta para `/auth/login`.

3. **Nova página `ResetPassword.tsx`** (`src/pages/auth/ResetPassword.tsx`)
   - Página pública (fora do `ProtectedRoute`).
   - Detecta sessão de recovery: o Supabase coloca tokens no hash da URL e o `onAuthStateChange` dispara `PASSWORD_RECOVERY`. Vou usar esse listener para liberar o form.
   - Form com nova senha + confirmação (validação mínima: 8+ chars, igualdade).
   - Chama `supabase.auth.updateUser({ password })`.
   - Em sucesso: toast + redirect para `/auth/callback` (que já resolve tenant/onboarding).
   - Se acessada sem sessão de recovery, mostra mensagem "Link inválido ou expirado" + botão para pedir novo link.

4. **Registrar rotas em `src/App.tsx`**
   - `/auth/forgot-password` → `ForgotPassword`
   - `/auth/reset-password` → `ResetPassword`
   - Ambas públicas (fora do `ProtectedRoute`), assim como `/auth/login`.

## Validação (para ter certeza que funciona)

- Build automático do Lovable após o patch.
- Smoke test manual sugerido no preview:
  1. `/auth/login` → clicar em "Esqueceu sua senha?" → digita e-mail → recebe confirmação visual.
  2. Abrir o link recebido por e-mail → cai em `/auth/reset-password` → define nova senha → entra automaticamente.
- Se algo falhar nos logs do console/rede, ajusto antes de fechar.

## Detalhes técnicos

- Usa apenas `supabase.auth.resetPasswordForEmail` e `supabase.auth.updateUser` — nenhum schema/SQL/edge function novo.
- Sem mudanças em RLS, tabelas ou config de auth (e-mail já está habilitado).
- E-mails de recovery usam o template padrão do Lovable Cloud (sem necessidade de setup de domínio próprio agora).
- Mantém padrão visual: Tusker/Montserrat, lima-400 como acento, cantos pill nos botões.

## Fora do escopo

- Customização visual do e-mail de recovery (exigiria scaffold de templates + domínio verificado).
- Rate limiting custom — fica com o default do Supabase.
