import React from 'react';
import { Pin, Plus, Trash2, User } from 'lucide-react';
import { CharacterGender, CharacterProfile, CharacterRelationRule, GlossaryType } from '../../types';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

const MAX_RELATION_RULES = 20;

interface CharacterProfileFieldsProps {
  type: GlossaryType;
  isPinned: boolean;
  onChangePinned: (pinned: boolean) => void;
  characterProfile: CharacterProfile;
  onChangeProfile: (profile: CharacterProfile) => void;
  compact?: boolean;
}

export const CharacterProfileFields = React.memo(function CharacterProfileFields({
  type,
  isPinned,
  onChangePinned,
  characterProfile,
  onChangeProfile,
  compact = false,
}: CharacterProfileFieldsProps) {
  const relations = characterProfile.relations || [];
  const labelCls = compact
    ? 'block text-[9px] uppercase font-bold text-text-muted'
    : 'block text-[10px] uppercase font-bold text-text-muted mb-1';
  const inputCls =
    'w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish transition-all';

  const updateField = <K extends keyof CharacterProfile>(key: K, value: CharacterProfile[K]) => {
    onChangeProfile({
      ...characterProfile,
      [key]: value,
    });
  };

  const handleAddRelation = () => {
    if (relations.length >= MAX_RELATION_RULES) return;
    const next: CharacterRelationRule[] = [
      ...relations,
      { targetName: '', selfPronoun: '', targetPronoun: '' },
    ];
    updateField('relations', next);
  };

  const handleUpdateRelation = (
    idx: number,
    field: keyof CharacterRelationRule,
    value: string
  ) => {
    const next = relations.map((rel, i) => (i === idx ? { ...rel, [field]: value } : rel));
    updateField('relations', next);
  };

  const handleRemoveRelation = (idx: number) => {
    const next = relations.filter((_, i) => i !== idx);
    updateField('relations', next);
  };

  return (
    <div className="space-y-3 pt-1">
      <label className="flex items-center gap-2 text-xs text-text-main cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isPinned}
          onChange={(e) => onChangePinned(e.target.checked)}
          className="rounded-[2px] border-parchment-2 bg-ink text-polish focus:ring-polish cursor-pointer"
        />
        <Pin className={cn('w-3.5 h-3.5 shrink-0', isPinned ? 'text-polish' : 'text-text-muted')} />
        <span>Ghim thuật ngữ (luôn ưu tiên nạp vào ngữ cảnh dịch khi chọn từ điển)</span>
      </label>

      {type === 'character' && (
        <div className="bg-ink/40 border border-parchment-2 rounded-[2px] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-main flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-polish" />
              Hồ sơ nhân vật &amp; Quy tắc xưng hô
            </span>
            {((characterProfile.gender && characterProfile.gender !== 'unknown') ||
              Boolean(characterProfile.defaultSelfPronoun?.trim()) ||
              Boolean(characterProfile.defaultNarrativePronoun?.trim()) ||
              relations.length > 0) ? (
              <button
                type="button"
                onClick={() =>
                  onChangeProfile({
                    gender: 'unknown',
                    defaultSelfPronoun: '',
                    defaultNarrativePronoun: '',
                    relations: [],
                  })
                }
                className="text-[10px] font-bold text-text-muted hover:text-error transition-colors cursor-pointer"
                title="Xóa toàn bộ hồ sơ nhân vật"
              >
                Xóa hồ sơ
              </button>
            ) : (
              <span className="text-[10px] text-text-muted">Tùy chọn</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className={labelCls}>Giới tính</label>
              <select
                value={characterProfile.gender || 'unknown'}
                onChange={(e) => updateField('gender', e.target.value as CharacterGender)}
                className={cn(inputCls, 'cursor-pointer')}
              >
                <option value="unknown" className="bg-parchment text-text-main">Chưa rõ</option>
                <option value="male" className="bg-parchment text-text-main">Nam</option>
                <option value="female" className="bg-parchment text-text-main">Nữ</option>
                <option value="neutral" className="bg-parchment text-text-main">Trung tính</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Tự xưng mặc định</label>
              <input
                type="text"
                maxLength={40}
                placeholder="ta, tại hạ, muội..."
                value={characterProfile.defaultSelfPronoun || ''}
                onChange={(e) => updateField('defaultSelfPronoun', e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Ngôi kể thứ 3</label>
              <input
                type="text"
                maxLength={40}
                placeholder="hắn, nàng, lão..."
                value={characterProfile.defaultNarrativePronoun || ''}
                onChange={(e) => updateField('defaultNarrativePronoun', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-text-muted">
                Xưng hô với nhân vật khác ({relations.length}/{MAX_RELATION_RULES})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRelation}
                disabled={relations.length >= MAX_RELATION_RULES}
                icon={<Plus className="w-3 h-3" />}
              >
                Thêm quan hệ
              </Button>
            </div>

            {relations.length > 0 && (
              <div className="space-y-1.5">
                {relations.map((rel, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-1.5 items-center">
                    <input
                      type="text"
                      maxLength={120}
                      placeholder="Tên đối tượng..."
                      value={rel.targetName}
                      onChange={(e) => handleUpdateRelation(idx, 'targetName', e.target.value)}
                      className={inputCls}
                      aria-label={`Đối tượng quan hệ ${idx + 1}`}
                    />
                    <input
                      type="text"
                      maxLength={40}
                      placeholder="Tự xưng là..."
                      value={rel.selfPronoun}
                      onChange={(e) => handleUpdateRelation(idx, 'selfPronoun', e.target.value)}
                      className={inputCls}
                      aria-label={`Tự xưng là ${idx + 1}`}
                    />
                    <input
                      type="text"
                      maxLength={40}
                      placeholder="Gọi đối phương là..."
                      value={rel.targetPronoun}
                      onChange={(e) => handleUpdateRelation(idx, 'targetPronoun', e.target.value)}
                      className={inputCls}
                      aria-label={`Gọi đối phương là ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveRelation(idx)}
                      className="p-1.5 text-text-muted hover:text-polish rounded-[2px] hover:bg-parchment-2 cursor-pointer transition-colors"
                      title="Xóa quy tắc xưng hô"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default CharacterProfileFields;
