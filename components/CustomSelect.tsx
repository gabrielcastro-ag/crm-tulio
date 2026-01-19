import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, LucideIcon } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    icon?: LucideIcon;
    disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Selecione...',
    icon: Icon,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full bg-dark-800 border border-gray-700 rounded-xl p-3 text-left flex items-center justify-between focus:ring-2 focus:ring-primary-500 outline-none transition-all
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-600'}
          ${Icon ? 'pl-10' : ''}
        `}
            >
                {Icon && (
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                )}

                <span className={`block truncate ${!selectedOption ? 'text-gray-500' : 'text-white'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>

                <ChevronDown
                    size={18}
                    className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-dark-800 border border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fade-in-down custom-scrollbar">
                    <ul className="py-1">
                        {options.map((option) => (
                            <li key={option.value}>
                                <button
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={`w-full text-left px-4 py-3 flex items-center justify-between group transition-colors
                    ${option.value === value ? 'bg-primary-500/10 text-primary-500' : 'text-gray-300 hover:bg-dark-700 hover:text-white'}
                  `}
                                >
                                    <span className="block truncate">{option.label}</span>
                                    {option.value === value && <Check size={16} />}
                                </button>
                            </li>
                        ))}
                        {options.length === 0 && (
                            <li className="px-4 py-3 text-gray-500 text-center text-sm">
                                Nenhuma opção
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};
