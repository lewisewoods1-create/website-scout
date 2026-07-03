import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] React crash:", error);
    console.error("[ErrorBoundary] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "#0a0a0c",
          color: "#f4f4f5",
          fontFamily: "system-ui, sans-serif",
          padding: "40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            maxWidth: "600px",
            width: "100%",
            background: "#141418",
            border: "1px solid #2a2a2e",
            borderRadius: "16px",
            padding: "32px",
          }}>
            <h1 style={{ color: "#f87171", fontSize: "24px", marginBottom: "16px" }}>
              Something went wrong
            </h1>
            <p style={{ color: "#8c8c96", marginBottom: "16px" }}>
              The app crashed. Please refresh the page or go back to login.
            </p>
            <pre style={{
              background: "#0a0a0c",
              border: "1px solid #2a2a2e",
              borderRadius: "8px",
              padding: "16px",
              overflow: "auto",
              fontSize: "13px",
              color: "#f87171",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {this.state.error?.name}: {this.state.error?.message}
              {"\n"}
              {this.state.error?.stack}
            </pre>
            <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "10px 20px",
                  background: "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Refresh Page
              </button>
              <button
                onClick={() => { window.location.href = "/login"; }}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  color: "#8c8c96",
                  border: "1px solid #2a2a2e",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
