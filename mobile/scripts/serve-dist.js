const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const port = Number(process.env.PORT || 8081);
const dist = path.resolve(__dirname, "..", "dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, { "Content-Type": contentType });
  response.end(body);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const target = path.resolve(dist, requested);

  if (!target.startsWith(dist)) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.readFile(target, (error, data) => {
    if (error) {
      fs.readFile(path.join(dist, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) send(response, 404, "Not found");
        else send(response, 200, fallback, types[".html"]);
      });
      return;
    }

    send(response, 200, data, types[path.extname(target)] || "application/octet-stream");
  });
});

server.listen(port, () => {
  console.log(`Serving ${dist} at http://localhost:${port}`);
});
