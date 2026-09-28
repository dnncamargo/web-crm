export type TaskItem = {
  id: string;
  text: string;
  done: boolean;
};

export type OptionalField = {
  id: string;
  type: 'text' | 'address' | 'tasks' | 'additionalPhone' | 'additionalEmail' | 'url';
  label: string;
  value: any;
};
