export function successResponse<T>(data: T, message = 'success') {
  return Response.json({ code: 0, message, data })
}

export function errorResponse(code: number, message: string) {
  return Response.json({ code, message, data: null })
}
