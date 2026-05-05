import { beforeEach, describe, expect, it, vi } from "vitest";
import { npmAdapter } from "../npm.js";

vi.mock("execa", () => ({
	execa: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

describe("npmAdapter", () => {
	beforeEach(async () => {
		const { execa } = await import("execa");
		(execa as unknown as { mockClear: () => void }).mockClear();
	});

	it("name is 'npm'", () => {
		expect(npmAdapter.name).toBe("npm");
	});

	it("runScript invokes `npm run <name>`", async () => {
		const { execa } = await import("execa");
		await npmAdapter.runScript("build", "/cwd");
		expect(execa).toHaveBeenCalledWith(
			"npm",
			["run", "build"],
			expect.objectContaining({ cwd: "/cwd", stdio: "inherit" }),
		);
	});

	it("install invokes `npm install`", async () => {
		const { execa } = await import("execa");
		await npmAdapter.install("/cwd");
		expect(execa).toHaveBeenCalledWith(
			"npm",
			["install"],
			expect.objectContaining({ cwd: "/cwd", stdio: "inherit" }),
		);
	});
});
