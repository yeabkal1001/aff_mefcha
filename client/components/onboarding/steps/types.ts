export interface StepProps {
  index: number;
  count: number;
  onNext: () => void;
  onBack?: () => void;
}
