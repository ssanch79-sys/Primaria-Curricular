import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Activity, CurriculumItem } from '../types';
import { CURRICULUM_DATA, AREA_COLORS } from '../constants';
import { Sparkles, Save, X, Wand2, Loader2, ChevronRight, Check, GraduationCap, Lightbulb, Tag, Link as LinkIcon, CalendarRange, ListChecks, FileText, Printer, Maximize2, FilePlus, ChevronDown, Copy, ArrowRight } from 'lucide-react';
import { suggestActivityDetails, suggestCurriculumLinks, suggestEvaluation, generateRubricHTML, expandActivityContent } from '../services/gemini';
import { CompetencyBadge } from './ui/CompetencyBadge';
import { Modal } from './ui/Modal';

interface ActivityFormProps {
  initialData?: Activity;
  availableTags?: string[];
  onSave: (activity: Activity) => void;
  onCancel: () => void;
}

// Helper to remove markdown asterisks
const cleanText = (text: string) => {
  return text.replace(/\*\*/g, '').replace(/\*/g, '');
};

export const ActivityForm: React.FC<ActivityFormProps> = ({ initialData, availableTags = [], onSave, onCancel }) => {
  // Generate academic years
  const academicYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
        `${currentYear - 1}-${currentYear}`,
        `${currentYear}-${currentYear + 1}`,
        `${currentYear + 1}-${currentYear + 2}`
    ];
  }, []);

  // Form Fields
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [link, setLink] = useState(initialData?.link || '');
  const [grade, setGrade] = useState(initialData?.grade || '5è');
  const [trimestre, setTrimestre] = useState(initialData?.trimestre || '1r');
  const [academicYear, setAcademicYear] = useState(initialData?.academicYear || '2024-2025');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialData?.curriculumIds || []);
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>(initialData?.criteria || []);
  const [evaluation, setEvaluation] = useState(initialData?.evaluation || '');
  
  // Tag State
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const tagInputContainerRef = useRef<HTMLDivElement>(null);
  
  // Filter suggestions based on input and exclude already selected tags
  const filteredTags = useMemo(() => {
    const lowerInput = tagInput.toLowerCase().trim();
    const unselectedTags = availableTags.filter(tag => !tags.includes(tag));

    // If input is empty, show all unselected tags
    if (!lowerInput) return unselectedTags;
    
    return unselectedTags.filter(tag => 
        tag.toLowerCase().includes(lowerInput)
    );
  }, [tagInput, availableTags, tags]);

  // Navigation State for the 3-column view
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [activeCE, setActiveCE] = useState<string | null>(null); 
  
  // AI State
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isExpandingDesc, setIsExpandingDesc] = useState(false);
  const [isGeneratingEval, setIsGeneratingEval] = useState(false);
  const [isSuggestingLinks, setIsSuggestingLinks] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; reason: string }[]>([]);

  // Rubric Document State
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);
  const [rubricHTML, setRubricHTML] = useState('');
  const [isGeneratingRubricDoc, setIsGeneratingRubricDoc] = useState(false);

  // Derived Data
  const uniqueAreas = useMemo(() => Array.from(new Set(CURRICULUM_DATA.map(c => c.area))), []);
  
  // Filter items by the selected Grade
  const filterByGrade = (item: CurriculumItem) => {
      if (!item.planificat) return true; 
      if (['1r', '2n'].includes(grade) && (item.planificat.includes('1r') || item.planificat.includes('2n') || item.planificat.includes('Inicial'))) return true;
      if (['3r', '4t'].includes(grade) && (item.planificat.includes('3r') || item.planificat.includes('4t') || item.planificat.includes('Mitjà'))) return true;
      if (['5è', '6è'].includes(grade) && (item.planificat.includes('5è') || item.planificat.includes('6è') || item.planificat.includes('Superior'))) return true;
      return true; 
  };

  const specificCompetenciesForArea = useMemo(() => {
    if (!activeArea) return [];
    const items = CURRICULUM_DATA.filter(c => c.area === activeArea);
    const uniqueCEs = Array.from(new Set(items.map(c => c.competenciaEspecifica)));
    return uniqueCEs.map(ce => {
        const firstMatch = items.find(i => i.competenciaEspecifica === ce);
        return {
            code: ce,
            saber: firstMatch?.saber || '',
            description: firstMatch?.description || ''
        };
    });
  }, [activeArea]);

  const itemsForActiveCE = useMemo(() => {
    if (!activeArea || !activeCE) return [];
    return CURRICULUM_DATA.filter(c => 
        c.area === activeArea && 
        c.competenciaEspecifica === activeCE &&
        filterByGrade(c)
    );
  }, [activeArea, activeCE, grade]);

  // Initialize navigation if editing
  useEffect(() => {
    if (initialData && initialData.curriculumIds.length > 0 && !activeArea) {
      const firstItem = CURRICULUM_DATA.find(c => c.id === initialData.curriculumIds[0]);
      if (firstItem) {
        setActiveArea(firstItem.area);
        setActiveCE(firstItem.competenciaEspecifica);
      }
    } else if (!activeArea && uniqueAreas.length > 0) {
        setActiveArea(uniqueAreas[0]);
    }
  }, [initialData, uniqueAreas]);

  const getSelectedCount = (filterFn: (item: CurriculumItem) => boolean) => {
    return CURRICULUM_DATA.filter(item => filterFn(item) && selectedIds.includes(item.id)).length;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newActivity: Activity = {
      id: initialData?.id || Date.now().toString(),
      title,
      description,
      link,
      grade,
      trimestre,
      academicYear,
      curriculumIds: selectedIds,
      criteria: selectedCriteria,
      evaluation,
      tags,
      createdAt: initialData?.createdAt || Date.now(),
    };
    onSave(newActivity);
  };

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
      setShowTagSuggestions(false);
      setActiveSuggestionIndex(-1);
    } else {
      setTagInput('');
    }
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setTagInput(e.target.value);
      setShowTagSuggestions(true);
      setActiveSuggestionIndex(-1); // Reset selection when typing
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If suggestion selected, add it. Otherwise add input text.
      if (showTagSuggestions && activeSuggestionIndex >= 0 && filteredTags[activeSuggestionIndex]) {
          handleAddTag(filteredTags[activeSuggestionIndex]);
      } else {
          handleAddTag(tagInput);
      }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredTags.length > 0) {
            setShowTagSuggestions(true);
            setActiveSuggestionIndex(prev => (prev < filteredTags.length - 1 ? prev + 1 : prev));
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredTags.length > 0) {
            setActiveSuggestionIndex(prev => (prev > -1 ? prev - 1 : -1));
        }
    } else if (e.key === 'Escape') {
        setShowTagSuggestions(false);
        setActiveSuggestionIndex(-1);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (tagInputContainerRef.current && !tagInputContainerRef.current.contains(event.target as Node)) {
              setShowTagSuggestions(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleGenerateDescription = async () => {
    if (!title) return;
    setIsGeneratingDesc(true);
    const suggested = await suggestActivityDetails(title, grade);
    if (suggested) setDescription(cleanText(suggested));
    setIsGeneratingDesc(false);
  };

  const handleExpandDescription = async () => {
    if (!description) return;
    setIsExpandingDesc(true);
    const expanded = await expandActivityContent(title, description, grade);
    if (expanded) setDescription(cleanText(expanded));
    setIsExpandingDesc(false);
  };

  const handleGenerateEvaluation = async () => {
    if (!title || !description) return;
    setIsGeneratingEval(true);
    const suggested = await suggestEvaluation(title, description, grade);
    if (suggested) setEvaluation(cleanText(suggested));
    setIsGeneratingEval(false);
  };

  const handleGenerateRubricDoc = async () => {
    if (!title) return;
    setIsGeneratingRubricDoc(true);

    // Enrich criteria with their Competency Code (CE)
    const enrichedCriteria = selectedCriteria.map(crit => {
        // Find the curriculum item that contains this criteria string
        const parentItem = CURRICULUM_DATA.find(item => item.criteris.includes(crit));
        if (parentItem) {
            // Prepend CE code if found, e.g., "CE1 - 1.1. ..."
            return `${parentItem.competenciaEspecifica} - ${crit}`;
        }
        return crit;
    });

    const html = await generateRubricHTML(title, description, enrichedCriteria, grade);
    setRubricHTML(html);
    setIsRubricModalOpen(true);
    setIsGeneratingRubricDoc(false);
  };

  const handlePrintRubric = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`
            <html>
            <head>
                <title>Rúbrica - ${title}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; max-width: 1000px; margin: 0 auto; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid black; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                ${rubricHTML}
                <script>window.print();</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
  };

  const handleCopyHTML = () => {
      const blob = new Blob([rubricHTML], { type: 'text/html' });
      const plainText = rubricHTML.replace(/<[^>]+>/g, '\n').trim();
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      
      const clipboardItem = new ClipboardItem({ 
          'text/html': blob,
          'text/plain': textBlob
      });
      
      navigator.clipboard.write([clipboardItem]).then(() => {
          alert("Contingut copiat al porta-papers! Ara pots enganxar-lo (Ctrl+V) a Word, Docs o altres editors.");
      }).catch(err => {
          console.error('Error copying to clipboard', err);
          alert('No s\'ha pogut copiar automàticament.');
      });
  };

  const handleOpenGoogleDoc = () => {
      const blob = new Blob([rubricHTML], { type: 'text/html' });
      const plainText = rubricHTML.replace(/<[^>]+>/g, '\n').trim(); 
      const textBlob = new Blob([plainText], { type: 'text/plain' });

      const clipboardItem = new ClipboardItem({ 
          'text/html': blob,
          'text/plain': textBlob
      });
      
      navigator.clipboard.write([clipboardItem]).then(() => {
          const win = window.open('https://docs.google.com/document/create', '_blank');
          if (win) win.focus();
      }).catch(err => {
          console.error('Error copying to clipboard', err);
          alert('No s\'ha pogut copiar. Fes servir el botó "Copiar Text" i enganxa-ho manualment.');
      });
  };

  const handleSuggestLinks = async () => {
    if (!title && !description) return;
    setIsSuggestingLinks(true);
    setSuggestions([]); 
    
    const results = await suggestCurriculumLinks(title, description);
    
    if (results.length > 0) {
        const ids = results.map(r => r.id);
        const merged = Array.from(new Set([...selectedIds, ...ids]));
        setSelectedIds(merged);
        setSuggestions(results);
        
        // Navigate to first suggestion
        const firstSuggested = CURRICULUM_DATA.find(c => c.id === ids[0]);
        if (firstSuggested) {
            setActiveArea(firstSuggested.area);
            setActiveCE(firstSuggested.competenciaEspecifica);
        }
    }
    setIsSuggestingLinks(false);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const isSelecting = !prev.includes(id);
      if (!isSelecting) {
        const item = CURRICULUM_DATA.find(c => c.id === id);
        if (item && item.criteris) {
           setSelectedCriteria(current => current.filter(c => !item.criteris.includes(c)));
        }
        return prev.filter(cid => cid !== id);
      }
      return [...prev, id];
    });
  };

  const toggleCriterion = (criterion: string) => {
    setSelectedCriteria(prev => 
      prev.includes(criterion) 
      ? prev.filter(c => c !== criterion) 
      : [...prev, criterion]
    );
  };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

          const newActivity: Activity = {
                  id: initialData?.id || '',
                  title,
                  description,
                  grade: grade as '5è' | '6è',
                  trimestre: trimestre as '1r' | '2n' | '3r',
                  academicYear,
                         link,
                  curriculumIds: selectedIds,
                  criteria: selectedCriteria
                        };

          onSave(newActivity);
        };

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col h-[calc(90vh-8rem)]">
      {/* Top Section: Basic Info */}
      <div className="flex-none space-y-4 mb-6 pr-2 overflow-y-auto">
      </div>
    </form>
  );
};

export default ActivityForm;
