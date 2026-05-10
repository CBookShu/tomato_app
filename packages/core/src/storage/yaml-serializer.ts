// packages/core/src/storage/yaml-serializer.ts
import * as yaml from 'js-yaml';

export function stringifyYaml(data: unknown): string {
  return yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}

export function parseYaml<T = unknown>(content: string): T {
  return yaml.load(content) as T;
}
