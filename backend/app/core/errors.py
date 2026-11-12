from typing import Any, Optional
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[Any] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorEnvelope(
                error=ErrorDetail(
                    code=exc.code,
                    message=exc.message,
                    details=exc.details,
                )
            ).model_dump(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorEnvelope(
                error=ErrorDetail(
                    code="VALIDATION_ERROR",
                    message="Request validation failed.",
                    details=exc.errors(),
                )
            ).model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorEnvelope(
                error=ErrorDetail(
                    code="INTERNAL_ERROR",
                    message="An unexpected server error occurred.",
                    details=str(exc) if not isinstance(exc, AssertionError) else None,
                )
            ).model_dump(),
        )
