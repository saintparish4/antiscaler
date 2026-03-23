import { z } from "zod";

const defaultCache = {
  mode: "content" as const,
  directory: ".antiscale/cache",
};

export const taskConfigSchema = z.object({
  inputs: z.array(z.string()).optional(),
  dependsOn: z.array(z.string()).optional(),
  command: z.string().optional(),
});

export const antiscaleConfigSchema = z.object({
  strategy: z.enum(["adaptive", "strict"]).default("adaptive"),
  cache: z
    .object({
      mode: z.literal("content").default(defaultCache.mode),
      directory: z.string().default(defaultCache.directory),
    })
    .default(defaultCache),
  tasks: z.record(z.string(), taskConfigSchema).default({}),
});
