"""Failures that come from outside the process."""


class ProviderError(RuntimeError):
    """A provider was reachable but did not do what was asked."""

    def __init__(self, provider: str, detail: str):
        self.provider = provider
        self.detail = detail
        super().__init__(f"{provider}: {detail}")


class ProviderNotConfigured(ProviderError):
    """The key for this provider is missing.

    Raised at the point of use, never at import. The server boots with no keys at all
    so that the parts of the product that need none still run, and the failure, when it
    comes, names the environment variable to set.
    """

    def __init__(self, provider: str, env_var: str):
        super().__init__(provider, f"no API key — set {env_var} in server/.env")
        self.env_var = env_var
