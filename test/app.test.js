const request = require("supertest");
const app = require("../src/app");

describe("Sample API", () => {
  test("GET /health returns HTTP 200", async () => {
    const response = await request(app).get("/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("healthy");
  });

  test("GET /api returns the deployment message", async () => {
    const response = await request(app).get("/api");

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toContain("Amazon EKS");
  });

  test("Unknown endpoint returns HTTP 404", async () => {
    const response = await request(app).get("/does-not-exist");

    expect(response.statusCode).toBe(404);
  });
});
