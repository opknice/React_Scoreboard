import { useState } from 'react';

export function useScoreboardMatchState() {
  const [nameA, setNameA] = useState('Team A');
  const [nameB, setNameB] = useState('Team B');
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [colorA1, setColorA1] = useState('#ffffff');
  const [colorA2, setColorA2] = useState('#ffffff');
  const [colorB1, setColorB1] = useState('#ffffff');
  const [colorB2, setColorB2] = useState('#ffffff');
  const [logoA, setLogoA] = useState('');
  const [logoB, setLogoB] = useState('');
  const [label1, setLabel1] = useState('');
  const [label2, setLabel2] = useState('');
  const [label3, setLabel3] = useState('');
  const [isEditingA, setIsEditingA] = useState(false);
  const [isEditingB, setIsEditingB] = useState(false);
  const [editNameAVal, setEditNameAVal] = useState('');
  const [editNameBVal, setEditNameBVal] = useState('');

  return {
    nameA, setNameA,
    nameB, setNameB,
    scoreA, setScoreA,
    scoreB, setScoreB,
    colorA1, setColorA1,
    colorA2, setColorA2,
    colorB1, setColorB1,
    colorB2, setColorB2,
    logoA, setLogoA,
    logoB, setLogoB,
    label1, setLabel1,
    label2, setLabel2,
    label3, setLabel3,
    isEditingA, setIsEditingA,
    isEditingB, setIsEditingB,
    editNameAVal, setEditNameAVal,
    editNameBVal, setEditNameBVal,
  };
}
