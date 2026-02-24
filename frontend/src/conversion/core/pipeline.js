export const runPipeline = async (steps, ctx, logger, tracer) => {
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    ctx.stage = step.name;
    const label = ctx.stageLabels?.[step.name] || step.name;
    ctx.hooks?.onStage?.({
      name: step.name,
      label,
      index: i,
      total: steps.length
    });
    const span = tracer?.startSpan(step.name, { label });
    const started = Date.now();
    logger?.info('pipeline_step_start', { step: step.name, label });
    try {
      await step.run(ctx);
      logger?.info('pipeline_step_done', {
        step: step.name,
        label,
        durationMs: Date.now() - started
      });
      span?.end({ status: 'ok' });
    } catch (error) {
      logger?.error('pipeline_step_failed', {
        step: step.name,
        label,
        durationMs: Date.now() - started,
        error: error?.message || String(error)
      });
      span?.end({ status: 'error', error });
      throw error;
    }
  }
  return ctx;
};
