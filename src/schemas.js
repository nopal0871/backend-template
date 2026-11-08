import { z } from 'zod';

export const TemplateConfig = z.object({
  title: z.string().max(200).default(''),
  artist: z.string().max(200).default(''),
  device: z.string().max(100).default('iPhone'),
  orient: z.enum(['portrait', 'landscape']).default('portrait'),
  blur: z.number().min(0).max(100).default(60),
  dim: z.number().min(0).max(70).default(20),
  volume: z.number().min(0).max(1).default(0.5),
  bgMode: z.enum(['album', 'image', 'color']).default('album'),
  colorTop: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#4a3a52'),
  colorBottom: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#10131a')
});

export const TemplateBody = z.object({
  name: z.string().min(1).max(100),
  config: TemplateConfig
});

export const ExportRequest = z.object({
  duration: z.number().positive().max(60 * 60),
  format: z.enum(['mp4', 'webm']).default('mp4'),
  templateId: z.string().optional().nullable()
});
