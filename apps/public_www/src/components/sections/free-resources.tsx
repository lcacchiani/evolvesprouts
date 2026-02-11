import type { FreeResourcesContent } from '@/content';

interface FreeResourcesProps {
  content: FreeResourcesContent;
}

export function FreeResources({ content }: FreeResourcesProps) {
  return (
    <section
      id="resources"
      aria-label={content.title}
      data-figma-node="Free Resources"
      className="w-full px-4 py-12 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <h2 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
          {content.title}
        </h2>
        {content.description && (
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            {content.description}
          </p>
        )}
        {/* TODO: Implement free resources layout from Figma design */}
      </div>
    </section>
  );
}
