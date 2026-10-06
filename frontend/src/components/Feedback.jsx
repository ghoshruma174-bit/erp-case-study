export function Feedback({ error, success }) {
  if (error) {
    return <p className="feedback error" role="alert">{error}</p>;
  }
  if (success) {
    return <p className="feedback success" role="status">{success}</p>;
  }
  return null;
}

export function Loading({ children = "Loading..." }) {
  return <p className="muted" role="status">{children}</p>;
}

export function EmptyState({ children }) {
  return <p className="empty-state">{children}</p>;
}
