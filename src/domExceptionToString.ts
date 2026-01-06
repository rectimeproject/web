export default function domExceptionToString(exception: unknown) {
  if (exception instanceof DOMException) {
    if (exception.message) {
      return `DOMException(${exception.message})`;
    }
    switch (exception.code) {
      case DOMException.INDEX_SIZE_ERR:
        return "DOMException(INDEX_SIZE_ERR)";
      case DOMException.DOMSTRING_SIZE_ERR:
        return "DOMException(DOMSTRING_SIZE_ERR)";
      case DOMException.HIERARCHY_REQUEST_ERR:
        return "DOMException(HIERARCHY_REQUEST_ERR)";
      case DOMException.WRONG_DOCUMENT_ERR:
        return "DOMException(WRONG_DOCUMENT_ERR)";
      case DOMException.INVALID_CHARACTER_ERR:
        return "DOMException(INVALID_CHARACTER_ERR)";
      case DOMException.NO_DATA_ALLOWED_ERR:
        return "DOMException(NO_DATA_ALLOWED_ERR)";
      case DOMException.NO_MODIFICATION_ALLOWED_ERR:
        return "DOMException(NO_MODIFICATION_ALLOWED_ERR)";
      case DOMException.NOT_FOUND_ERR:
        return "DOMException(NOT_FOUND_ERR)";
      case DOMException.NOT_SUPPORTED_ERR:
        return "DOMException(NOT_SUPPORTED_ERR)";
      case DOMException.INUSE_ATTRIBUTE_ERR:
        return "DOMException(INUSE_ATTRIBUTE_ERR)";
      case DOMException.INVALID_STATE_ERR:
        return "DOMException(INVALID_STATE_ERR)";
      case DOMException.SYNTAX_ERR:
        return "DOMException(SYNTAX_ERR)";
      case DOMException.INVALID_MODIFICATION_ERR:
        return "DOMException(INVALID_MODIFICATION_ERR)";
      case DOMException.NAMESPACE_ERR:
        return "DOMException(NAMESPACE_ERR)";
      case DOMException.INVALID_ACCESS_ERR:
        return "DOMException(INVALID_ACCESS_ERR)";
      case DOMException.VALIDATION_ERR:
        return "DOMException(VALIDATION_ERR)";
      case DOMException.TYPE_MISMATCH_ERR:
        return "DOMException(TYPE_MISMATCH_ERR)";
      case DOMException.SECURITY_ERR:
        return "DOMException(SECURITY_ERR)";
      case DOMException.NETWORK_ERR:
        return "DOMException(NETWORK_ERR)";
      case DOMException.ABORT_ERR:
        return "DOMException(ABORT_ERR)";
      case DOMException.URL_MISMATCH_ERR:
        return "DOMException(URL_MISMATCH_ERR)";
      case DOMException.QUOTA_EXCEEDED_ERR:
        return "DOMException(QUOTA_EXCEEDED_ERR)";
      case DOMException.TIMEOUT_ERR:
        return "DOMException(TIMEOUT_ERR)";
      case DOMException.INVALID_NODE_TYPE_ERR:
        return "DOMException(INVALID_NODE_TYPE_ERR)";
      case DOMException.DATA_CLONE_ERR:
        return "DOMException(DATA_CLONE_ERR)";
    }
  }
  return `${exception}`;
}
