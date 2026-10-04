import {
  relativeSeen,
  StaffMember,
  Translate,
} from '@/pages/lib/adminActivity';
import {
  fontClassName,
  hairline,
  muted,
  navy,
  onlineGreen,
} from '@/styles/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';

type Props = {
  staff: StaffMember[];
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Box>
      <Typography
        fontWeight={700}
        fontSize={20}
        color={navy}
        className={fontClassName.className}
      >
        {value}
      </Typography>
      <Typography
        fontSize={12}
        color={muted}
        className={fontClassName.className}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default function StaffCards({ staff, selectedId, onSelect }: Props) {
  const t = useTranslations();
  const translate = t as unknown as Translate;
  const now = new Date();

  const presenceText = (member: StaffMember): string => {
    if (member.online) return t('chatOnline');
    if (member.lastSeenAt == null) return t('activityNeverSeen');
    return t('activityLastSeen', {
      time: relativeSeen(member.lastSeenAt, now, translate),
    });
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
        gap: 1.5,
      }}
    >
      {staff.map((member) => {
        const selected = member.id === selectedId;
        return (
          <ButtonBase
            key={member.id}
            onClick={() => onSelect(selected ? undefined : member.id)}
            aria-pressed={selected}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              textAlign: 'left',
              gap: 1.5,
              p: 2,
              borderRadius: '14px',
              backgroundColor: '#fff',
              border: `2px solid ${selected ? navy : hairline}`,
              transition: 'border-color 120ms',
              '&:hover': { borderColor: navy },
            }}
          >
            <Box className="flex flex-row items-center gap-2">
              <Box
                aria-hidden
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  flexShrink: 0,
                  backgroundColor: member.online ? onlineGreen : muted,
                }}
              />
              <Typography
                fontWeight={600}
                noWrap
                className={fontClassName.className}
              >
                {member.name}
              </Typography>
            </Box>
            <Typography
              fontSize={13}
              color={member.online ? onlineGreen : muted}
              className={fontClassName.className}
            >
              {presenceText(member)}
            </Typography>
            <Box className="flex flex-row gap-6">
              <Stat
                value={member.totalChanges}
                label={t('activityChangesLabel')}
              />
              <Stat
                value={member.customersAnswered}
                label={t('activityAnsweredLabel')}
              />
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
