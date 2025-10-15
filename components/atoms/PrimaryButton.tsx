"use client";

interface Props {
  text: string;
  onClick?: () => void;
}

export default function PrimaryButton({ text, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
    >
      {text}
    </button>
  );
}
