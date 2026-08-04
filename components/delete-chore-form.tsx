"use client";

import { useActionState, useState } from "react";
import {
  deleteChoreAction,
  type DeleteChoreState,
} from "@/app/admin/actions";

const initialState: DeleteChoreState = { error: "" };

export function DeleteChoreForm({ id, title }: { id: string; title: string }) {
  const [state, formAction, pending] = useActionState(deleteChoreAction, initialState);
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={formAction} className="delete-chore-form">
      <input name="id" type="hidden" value={id} />
      {confirming ? (
        <div aria-label={`Confirm deletion of ${title}`} className="delete-confirmation" role="group">
          <p>
            Permanently delete <strong>{title}</strong>? Pending and skipped check-offs will also be removed.
          </p>
          <button className="danger-button" disabled={pending} type="submit">
            {pending ? "Deleting…" : "Yes, delete permanently"}
          </button>
          <button className="secondary-button" disabled={pending} onClick={() => setConfirming(false)} type="button">
            Cancel
          </button>
        </div>
      ) : (
        <button className="danger-button" onClick={() => setConfirming(true)} type="button">
          Delete chore
        </button>
      )}
      <p aria-live="polite" className="form-error">{state.error}</p>
    </form>
  );
}
