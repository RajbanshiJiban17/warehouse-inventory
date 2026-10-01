from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from fastapi.responses import JSONResponse
from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    OWASP ASVS / Top 10 Security Headers Middleware.
    Enforces strict CSP, HSTS, frame protection, and content type sniffing protection.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Clickjacking defense
        response.headers["X-Frame-Options"] = "DENY"
        
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Restrict dangerous browser features
        response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"
        
        # Content Security Policy (allows self scripts & styles)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self' data:; "
            "connect-src 'self'"
        )

        # HSTS only in production (HTTPS)
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        return response


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    CSRF defense for cookie-authenticated browser requests.
    Validates custom header on state-changing methods (POST, PUT, PATCH, DELETE).
    Safe methods (GET, HEAD, OPTIONS) are exempt.
    """
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
    EXEMPT_PATHS = {"/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/health", "/docs", "/redoc", "/openapi.json"}

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method not in self.SAFE_METHODS and request.url.path not in self.EXEMPT_PATHS:
            # If using cookie authentication, check for custom header or bearer token
            has_auth_cookie = "access_token" in request.cookies or "refresh_token" in request.cookies
            if has_auth_cookie:
                custom_header = request.headers.get("x-requested-with") or request.headers.get("x-csrf-token")
                auth_header = request.headers.get("authorization")
                
                # If cookie is present without custom header or bearer token, block potential CSRF
                if not custom_header and not auth_header:
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "CSRF validation failed: Missing custom anti-forgery header (e.g. X-Requested-With: XMLHttpRequest)"},
                    )

        return await call_next(request)
