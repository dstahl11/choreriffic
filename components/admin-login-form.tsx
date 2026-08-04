"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/admin/actions";

const initialState: LoginState = { error: "" };

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  return (
    <form action={formAction} className="login-form">
      <label htmlFor="password">Admin password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        aria-invalid={Boolean(state.error)}
        aria-describedby="login-message"
        required
      />
      <p id="login-message" className={state.error ? "form-error" : "form-helper"}>
        {state.error || "Use the household admin password."}
      </p>
      <button type="submit" disabled={pending} data-state={pending ? "loading" : "default"}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
