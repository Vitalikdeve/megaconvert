import {
  abortUploadSchema,
  completeUploadSchema,
  downloadLinkQuerySchema,
  initiateUploadSchema,
  signUploadPartsSchema
} from "@messenger/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { S3MultipartUploadService } from "../application/s3-multipart-upload.service";

const uploadParamsSchema = z.object({
  uploadId: z.string().min(1)
});

export const registerUploadRoutes = (
  app: FastifyInstance,
  dependencies: {
    multipartUploadService: S3MultipartUploadService;
  }
) => {
  app.post("/v1/uploads/initiate", async (request, reply) => {
    const body = initiateUploadSchema.parse(request.body);
    const data = await dependencies.multipartUploadService.initiate(body);
    reply.code(201);

    return {
      data
    };
  });

  app.get("/v1/uploads/:uploadId", async (request) => {
    const params = uploadParamsSchema.parse(request.params);
    const data = await dependencies.multipartUploadService.getStatus(
      params.uploadId
    );

    return {
      data
    };
  });

  app.post("/v1/uploads/:uploadId/parts/sign", async (request) => {
    const params = uploadParamsSchema.parse(request.params);
    const body = signUploadPartsSchema.parse(request.body);
    const data = await dependencies.multipartUploadService.signParts(params.uploadId, body);

    return {
      data
    };
  });

  app.post("/v1/uploads/:uploadId/complete", async (request) => {
    const params = uploadParamsSchema.parse(request.params);
    const body = completeUploadSchema.parse(request.body);
    const data = await dependencies.multipartUploadService.complete(params.uploadId, body);

    return {
      data
    };
  });

  app.post("/v1/uploads/:uploadId/abort", async (request) => {
    const params = uploadParamsSchema.parse(request.params);
    const body = abortUploadSchema.parse(request.body);
    const data = await dependencies.multipartUploadService.abort(
      params.uploadId,
      body
    );

    return {
      data
    };
  });

  app.get("/v1/uploads/download-link", async (request) => {
    const query = downloadLinkQuerySchema.parse(request.query);
    const data = await dependencies.multipartUploadService.createDownloadLink(
      query.objectKey
    );

    return {
      data
    };
  });
};
