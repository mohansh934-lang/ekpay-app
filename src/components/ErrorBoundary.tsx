"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Screen crash hone par pura app crash nahi hoga — sirf error message dikhega */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("EkApp Screen Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😵</div>
          <b style={{ fontSize: 16 }}>Kuch gadbad ho gayi</b>
          <p className="mu" style={{ marginTop: 6 }}>
            Is screen me error aa gaya. Dobara try karo ya doosri screen pe jaao.
          </p>
          <button
            className="btn o"
            style={{ marginTop: 14 }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Dobara Try Karo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

