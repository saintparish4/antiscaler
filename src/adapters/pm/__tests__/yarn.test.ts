import { beforeEach, describe, expect, it, vi } from "vitest";
import { yarnAdapter } from "../yarn.js";

vi.mock("execa", () => ({
	execa: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

describe("yarnAdapter", () => {
	beforeEach(async () => {
		const { execa } = await import("execa");
		(execa as unknown as { mockClear: () => void }).mockClear();
	});

	it("name is 'yarn'", () => {
		expect(yarnAdapter.name).toBe("yarn");
	});

	it("runScript invokes `yarn run <name>`", async () => {
		const { execa } = await import("execa");
		await yarnAdapter.runScript("lint", "/repo");
		expect(execa).toHaveBeenCalledWith(
			"yarn",
			["run", "lint"],
			expect.objectContaining({ cwd: "/repo", stdio: "inherit" }),
		);
	});

	it("install invokes `yarn install`", async () => {
		const { execa } = await import("execa");
		await yarnAdapter.install("/repo");
		expect(execa).toHaveBeenCalledWith(
			"yarn",
			["install"],
			expect.objectContaining({ cwd: "/repo", stdio: "inherit" }),
		);
	});
});
