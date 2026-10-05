// CloudFront Function (viewer-request, site behavior only). Serves the entry document for client-side
// paths, i.e. any path whose last segment has no file extension. A missing file with an extension is
// left alone so it stays a failure, and /api/* is never rewritten so API errors are never masked.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === '/api' || uri.indexOf('/api/') === 0) {
    return request;
  }

  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}
